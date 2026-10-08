# Paxy browser test page

Open http://localhost:8010/ after starting `docker compose up -d --force-recreate paxy`
from the workspace's `docker/` folder. Nginx serves this directory directly; refresh after edits, with no
build required. Use a hard refresh if the browser has cached scripts or styles.

## Files

- `index.html`: page markup and ordered script includes.
- `css/paxy.css`: layout, status panel and custom chat invitation styling.
- `js/page-state.js`: default article/category, query parameters, shared state and logging.
- `js/cart-simulation.js`: renderer handshake and simulated cart success/failure/timeout.
- `js/page-context.js`: direct articleCode/categoryId payload and simulated navigation.
- `js/chat-invite.js`: custom launcher styling, invitation timing and opening chat.
- `js/messaging-events.js`: Salesforce lifecycle listeners.
- `js/bootstrap.js`: Salesforce deployment initialization and SDK load callbacks.
- `js/page.js`: DOM initialization and button bindings.

These are classic scripts sharing the original page-level bindings. Keep their
order in the HTML; all lifecycle listeners must be registered before the remote
Salesforce bootstrap script loads. No bundler or package installation is needed.

## Context testing

The initial article defaults to `756798` and category to `10001`. Override with:

    http://localhost:8010/?article=540371&categoryId=AZ_83790

On Salesforce Ready, the page sends direct `articleCode` and `categoryId` text variables. The **Simulate variant navigation** button changes the URL and live
context without reloading the page or closing chat.
**Simulate product-page navigation** performs a full document navigation using
the entered article/category, rerunning initialization and allowing the widget
to resume its existing conversation. It does not clear chat storage. Blank
inputs on a full navigation use the original default article/category behavior. No hidden pre-chat fields are sent.

The cart controls simulate acknowledgements only; they do not add cart items.
The renderer origin allowlist is in `cart-simulation.js`; the Salesforce
`Paxi_testing` deployment initialization is in `bootstrap.js`. The remote SDK
URL is in `index.html` and must stay aligned with that deployment.

Local checks use a mocked SDK; live-agent behavior must be verified separately.

## Small live context probe

`scripts/context_probe.py` reuses the automation project's browser chat helper.
By default it asks exactly `test context`, checks both article and category in a new reply,
and records conversation-creation/message payloads, HTTP statuses, console
warnings, replies and screenshots. Default mode uses the page's context handling;
the opt-in experiments below can explicitly resend context. Each repetition starts with a new browser context. Within it, the probe checks
initial context, then changes IDs through ten variant changes and ten full page
navigations. All 21 replies must retain the same conversation ID.

From this workspace's root folder on your Mac:

```bash
python3 plans/in_progress/001-article-context-scenarios/assets/paxy/scripts/run_context_probe.py \
  -- --runs 10
```

This runs **ten fresh sessions**, each with:

1. One initial context check.
2. Ten variant navigations using `#update-page-context` (no reload).
3. Ten product-page navigations using `#navigate-product-page` (full reload).

That is **200 navigation checks plus 10 initial checks**. Each checks a new
reply for both article and category and verifies conversation continuity.
Article and category both increase by one per check, starting at 1. IDs continue
across sessions: session 1 checks 1–21, session 2 checks 22–42, through 210.
These synthetic IDs test context propagation, not catalogue existence. Reply mismatches are recorded
and testing continues; browser/setup errors stop that session, and unexecuted
steps are counted as `not_run` rather than passing.

For a short smoke run, use `--runs 1 --variants 1 --pages 1`. Counts are
configurable independently; `--variants 0 --pages 0` checks initial context only.
Use `--start-id` to begin at another positive number.
The browser uses `http://localhost:8010`, matching Salesforce’s allowed origin.
The probe temporarily serves the static files from `http://paxy` through a
loopback listener inside the runner; it does not proxy Salesforce traffic or
alter CSP/CORS headers. Port 8010 must be free inside the runner. The listener
ends with the script. For an existing server, use `--static-upstream ""` and
`--base-url` as needed. Run one probe process at a time.

Evidence is collected into this plan's `assets/runs/` folder after the run,
including failed runs. See [the asset guide](../README.md) for remote staging
and interruption recovery. Add `--ssh` before `--` when running inside Codex.
The standalone probe also creates one dashboard run and records each session
as one result, with its entire transcript, per-check evidence and screenshots. It prints the
run URL and session result URLs while running. No suite is registered and
no automation source is changed. Use `--no-dashboard` for files only.
Already-running processes retain the version they started with.
A nonzero exit status means at least one case failed, including setup failures.

## Publish the direct-variable Paxy agent

The test page now requires the updated Paxy authoring bundle in `krafty-chatbot`.
Paxy now routes directly to the agent. The welcome is static; live turns use
externally writable `articleCode` and `categoryId`. The page no longer calls
`setHiddenPrechatFields`.

From the `krafty-chatbot` repository:

```sh
sf agent validate authoring-bundle --api-name Paxy --target-org takkt-agentforce-int
sf agent publish authoring-bundle --api-name Paxy --target-org takkt-agentforce-int --skip-retrieve
```

Then activate the new version reported by publish (replace `VERSION`):

```sh
sf agent activate --api-name Paxy --version VERSION --target-org takkt-agentforce-int
```

The stale Paxy.v49 target was removed from the unversioned authoring bundle
metadata so it is a draft. Publishing creates a new version; do not assume its
number. No full project metadata deployment is needed for this change.
After activation, hard-refresh the test page, end the existing conversation,
and start a fresh session. Ask `test context`, then repeat after each navigation
button. Verify outgoing context has `articleCode` and `categoryId` TextValues.

### Parser removal

1. Already done in the draft: remove `Parse_Page_Context` from `before_reasoning`
   and its action definition; replace the parsed variables with direct variables.
2. Already done in the page: remove `buildAgentContextUrl` and the krafty-prefixed
   query parameters. The ordinary article/categoryId URL parameters still initialize
   the test controls and enable full document navigation.
3. Publish and activate as above. The new Paxy version will no longer call the parser.
4. Paxy now uses direct routing; this page no longer sends the old hidden
   ArticleNumber. Legacy flow/field metadata has not been deleted.
5. Do not delete the shared `TakktPageContextAction` class yet. Historical Paxy
   bundles still reference it (including local Paxy_10 and retrieved v51).
   Physical Apex cleanup is separate: inventory org dependencies, retire/remove
   dependent versions/actions where appropriate, remove any class-access references,
   then delete `TakktPageContextAction` and `TakktPageContextActionTest` with a scoped
   destructive deployment. Removing the parser from the active agent needs no
   destructive deployment and preserves rollback to older versions.

Local validation covered direct initial/update/empty
article payloads, and URL/default controls in Chromium. Org compilation and live
conversation behavior require the publish/activation steps above.

## Context lifecycle and retry delay

Fresh chats queue context with `sendWithNewConversation: true` after Ready.
An active-conversation marker in sessionStorage survives full page navigation.
Resumed chats wait for Ready and ConversationOpened, send context with
`sendWithNewConversation: false`, then reapply the latest control values after
500 ms. Variant changes send the latest values immediately; a pending retry
also uses the latest values. ConversationClosed cancels the retry and resets
state for a new chat. Minimizing or closing the window alone does not reset it.

Configure the retry delay in milliseconds before opening/resuming chat:

```js
window.PAXY_CONTEXT_RETRY_DELAY_MS = 500;
```

Set this in a script before `messaging-events.js` for a persistent page setting,
or in DevTools for the current document. Invalid/negative values fall back to
500 ms. This ports Krafty's lifecycle/reapply logic; it does not add Krafty's
input-blocking overlay or prove Salesforce has applied a queued update.

Dashboard reporting uses one result per fresh browser session. Each result contains the full captured welcome and conversation, per-check expected values, screenshots, and session evidence.json. A two-run invocation creates two results with 21 planned checks each; individual context mismatches do not stop navigation, while session execution errors mark unexecuted checks in the evidence.

The standalone probe uses a 750 × 1000 viewport and scrolls navigation buttons to the top of the viewport before clicking, clear of the bottom-right chat dock. Screenshots use that viewport size.

## Experimental context timing comparison

`--context-delay-ms 0 500 2000` cycles delays across fresh sessions. After chat
readiness and each navigation, the probe explicitly awaits the public SDK
`setSessionContext` call with `sendWithNewConversation: false`, waits the chosen
number of milliseconds, then asks the unchanged `test context` question.
For example use `--runs 3 --variants 5 --pages 2 --context-delay-ms 0 500 2000`.
The default (omit this option) remains the unmodified page-driven baseline.

This is a client-queue timing experiment, not a standalone server context API:
Salesforce documents that context is sent with the next message. Each turn's
`context_timing` records queue completion, pre-question time, SDK result and any
conversation POST indexes observed during the gap. Completed response bodies
remain captured. Agent-side application must still be checked using diagnostic
snapshots; HTTP 200 and an empty response body do not prove it.

## Server acknowledgement and prompt comparison

The opt-in `--context-primer --observe-context` experiment sends `[context-update]`
and the full current context together through the deployed host SDK's
`sendTextMessage(text, context)` method. This fixed marker contains no product
or category IDs. Both it and its reply remain visible during the experiment.
After a fresh primer reply and a UUID-matched context event, the native composer
asks `What product and category am I looking at?` without another context setter.
The final request must contain no context, and no intervening setter, extra
request, page change or conversation change may contaminate the check.
The transcript shows both turns; only the final question is scored. This is a
two-turn diagnostic, not proof of a one-call delivery guarantee or a production
fix. It adds an actual agent turn per check. It cannot be combined with the
persistence, delay or unique-prompt experiments. Default behavior is unchanged.

From the workspace root on your Mac, run two fresh sessions with two variants
and one full page navigation each (eight scored questions plus eight markers):

```sh
python3 plans/in_progress/001-article-context-scenarios/assets/paxy/scripts/run_context_probe.py \
  -- --runs 2 --variants 2 --pages 1 --context-primer --observe-context
```

To also compare the reserved URL with the active diagnostic agent, add
`--compare-current-page --current-page-origins https://at-kaiserkraft.preprod.kkeu.de`.
This only changes the URL supplied as context; the test still runs on localhost.

For a controlled persistence diagnostic, add `--probe-persistence --observe-context`.
After the first article/category mismatch in each session, the probe leaves the
page unchanged and asks another neutral `test context` question without calling
the setter. It then explicitly resends the current page context through the
existing helper and asks once more. It verifies actual request context, observed
setter calls, conversation continuity, unchanged URL/document and absence of
extra message requests. An isolation failure is reported as an execution error,
not interpreted as a context result.

Both extra replies are stored in the failed turn's `persistence_followups` and
included in the session transcript and Reason. They are excluded from navigation
pass/fail percentages, and the original failure remains failed. Later navigation
is affected by these extra turns, so this mode is a diagnostic experiment rather
than a directly comparable baseline. No extra fixed wait, page change or agent
publication is introduced. Omit the flag to retain the existing probe behavior.

Use `--observe-context` to capture the actual widget's
`CONVERSATION_SESSION_CONTEXT` server events, setter calls and promise outcomes.
The probe observes `EventSourcePolyfill` in every frame. This is optional test
instrumentation; the shared chat helper and served page scripts are unchanged.
Event payloads retain context-entry IDs, conversation IDs and related
MessagingSession IDs where Salesforce supplies them. An acknowledgement proves
that event was emitted, not that the planner had committed its variables.
Only explicitly allowlisted correlation headers are saved; authentication
headers are excluded.

`--prompt-modes fixed unique` alternates fresh sessions between the usual exact
`test context` and that question with a random alphabetic marker. The marker
contains no expected article/category data. This tests sensitivity to repeated
utterances; it is not a production workaround or a claim of server caching.
`--category-offset 10000` makes category IDs different from article IDs.

Example: `--runs 2 --variants 5 --pages 2 --start-id 2001 --category-offset 10000
--observe-context --prompt-modes fixed unique`. No extra wait is added.

`--compare-current-page` is a separate opt-in experiment. After deploying the
additive Paxy diagnostic candidate, it augments **every** page setter call with
`_AgentContext.currentPage`, built from that same call's article/category values
using `kraftyContext`, `kraftyArticle`, and `kraftyCategoryId`. It leaves visible
URLs and direct values unchanged, preserves creation/update options, and adds no
parser. This lets the diagnostic compare raw direct and reserved values in the
same turn. It is not enabled in the ordinary or unique-prompt tests.

With that comparison enabled, `--current-page-origins http://localhost:8010
https://example.com` cycles one supplied origin per fresh session. This is a
**synthetic context-value experiment** for investigating URL redaction: only the
origin inside `_AgentContext.currentPage` changes. The browser still visits the
normal Paxy page; replacement hosts are never visited or fetched by the probe.
The existing path, query, fragment, direct values, navigation, prompts and delays
are preserved. Use only origins you intend to include in the Salesforce context.
Values must be absolute HTTP(S) origins without credentials, a path other than
an optional trailing slash, a query, or a fragment. Omitting the option retains
the actual browser origin. The override and actual browser base URL are recorded
separately in session evidence, transcripts and console output. For example,
add `--compare-current-page --current-page-origins http://localhost:8010
https://example.com --runs 2` to compare these values in two fresh sessions.

## Summarize captured evidence offline

The standalone summarizer needs only Python's standard library. It accepts a
complete `results.json` or a session/turn `evidence.json` while a run continues:

```sh
python3 plans/in_progress/001-article-context-scenarios/assets/paxy/scripts/summarize_context_evidence.py /path/to/results.json \
  --diagnostics /path/to/salesforce-query.json \
  --output /path/to/context-summary.json
```

Omit `--diagnostics` until the Salesforce query is available. It reports expected,
outgoing, acknowledged, diagnostic and reply values separately. It joins server
events by context-entry UUID and conversation UUID, then diagnostic candidates
by the MessagingSession ID and the request-to-turn-completion time window,
expanded by two seconds. Every matching acknowledgement and diagnostic execution
is retained; the time window is not a guaranteed message-to-Apex association.
Missing evidence remains `unknown`. Initial context consumed on conversation
creation is shown separately with source `conversation-create`, including its
own UUID-matched acknowledgement. The JSON still records missing context on the
first user message as unknown; it does not claim creation context was sent again.

For the reserved page-context comparison, add `--show-current-page` to append
independent page-context sent, acknowledgement and diagnostic columns. The JSON
always includes `reserved_current_page` details and `reserved_current_page_counts`,
leaving the original direct-field counts unchanged. Raw URLs and all matching
acknowledgements/diagnostic candidates are retained. Only an absolute HTTP(S) URL
with exactly one each of `kraftyContext=1`, `kraftyArticle` and `kraftyCategoryId`
is compared. Explicit empty article/category parameters are valid empty values;
missing, duplicate or invalid parameters cannot pass. Ordinary URL parameters
are never used as a fallback. Wire evidence must come from `_AgentContext` with
`StructuredValue`; a separate direct `currentPage` variable is not equivalent.
The initial creation request and its exact UUID acknowledgement remain separate
from later message context. A matching reserved-context acknowledgement still
does not prove the diagnostic or planner received the updated URL.

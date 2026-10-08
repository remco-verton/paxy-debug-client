/*
 * Page UI initialization.
 */
// Loaded after the form: initialize without waiting for the remote widget SDK.
(function initializePage() {
        document.getElementById('article-input').value = currentArticleNumber;
        document.getElementById('category-input').value = currentCategoryId;
        document.getElementById("paxy-chat-invite").addEventListener("click", openChatFromInvite);
        document.getElementById("update-page-context").addEventListener("click", updatePageContextFromInputs);
        document.getElementById("navigate-product-page").addEventListener("click", navigateProductPageFromInputs);
        updatePageContextDisplay();
        document.getElementById('paxy-sim-host-origin').textContent = window.location.origin;

        log(
            'Page context article=' +
            currentArticleNumber +
            ', categoryId=' +
            currentCategoryId +
            ' (from query parameters or defaults)',
            'info'
        );
})();

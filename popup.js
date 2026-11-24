/**
 * @param {object} message
 */
async function sendToActiveTab(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    try {
        await chrome.tabs.sendMessage(tab.id, message);
    } catch {
        // Bỏ qua các trang nội bộ trình duyệt không chạy content script
    }
}

document.getElementById("toggle-pet")?.addEventListener("click", () => {
    sendToActiveTab({ type: "LILIANA_TOGGLE_VISIBLE" });
});

document.getElementById("summon-pet")?.addEventListener("click", () => {
    sendToActiveTab({ type: "LILIANA_SUMMON" });
});

document.getElementById("toggle-sit")?.addEventListener("click", () => {
    sendToActiveTab({ type: "LILIANA_TOGGLE_SIT" });
});


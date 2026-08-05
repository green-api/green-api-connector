const POPOUT_URL = chrome.runtime.getURL("popout.html");
const POPOUT_WIDTH = 420;
const POPOUT_HEIGHT = 400;

async function findPopoutWindowId(): Promise<number | undefined> {
    const [tab] = await chrome.tabs.query({ url: POPOUT_URL });
    return tab?.windowId;
}

export async function openPopout(): Promise<void> {
    const existingId = await findPopoutWindowId();
    if (existingId !== undefined) {
        await chrome.windows.update(existingId, { focused: true, drawAttention: true });
        return;
    }

    await chrome.windows.create({
        url: POPOUT_URL,
        type: "popup",
        width: POPOUT_WIDTH,
        height: POPOUT_HEIGHT,
        focused: true
    });
}

function isFromOwnExtension(sender: chrome.runtime.MessageSender): boolean {
    return sender.id === chrome.runtime.id && (sender.url ?? '').startsWith(chrome.runtime.getURL(''));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (typeof msg !== 'object' || msg === null)
        return undefined;

    if ((msg as Record<string, unknown>).type !== "OPEN_POPOUT")
        return undefined;

    if (!isFromOwnExtension(sender))
        return undefined;

    openPopout()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
    return true;
});

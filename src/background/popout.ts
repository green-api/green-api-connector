import { cancelImport, isFromOwnExtension } from "./index";

const POPOUT_URL = chrome.runtime.getURL("popout.html");
const POPOUT_WIDTH = 420;
const POPOUT_HEIGHT = 400;

let openedWindowId: number | undefined;

async function findPopoutWindowId(): Promise<number | undefined> {
    if (openedWindowId !== undefined) {
        try {
            await chrome.windows.get(openedWindowId);
            return openedWindowId;
        } catch {
            openedWindowId = undefined;
        }
    }

    const [tab] = await chrome.tabs.query({ url: POPOUT_URL });
    openedWindowId = tab?.windowId;
    return openedWindowId;
}

export async function openPopout(): Promise<void> {
    const existingId = await findPopoutWindowId();
    if (existingId !== undefined) {
        await chrome.windows.update(existingId, { focused: true, drawAttention: true });
        return;
    }

    const window = await chrome.windows.create({
        url: POPOUT_URL,
        type: "popup",
        width: POPOUT_WIDTH,
        height: POPOUT_HEIGHT,
        focused: true
    });
    openedWindowId = window?.id;
}

chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId !== openedWindowId)
        return;

    openedWindowId = undefined;
    void cancelImport();
});

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

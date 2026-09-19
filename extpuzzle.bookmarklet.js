javascript:(() => {

const EXTPUZZLE_VERSION = "0.1";
const VIEWER_URL = "https://tooro88.github.io/rotpuzzle/viewpuzzle.html";

const ICON_SIZE = 70;

const clipByAncestors = (img, rect) => {
    let node = img.parentElement;
    while (node) {
        if (node !== document.scrollingElement) {
            const cs = getComputedStyle(node);
            if (cs.overflowX !== "visible" ||
                cs.overflowY !== "visible") {
                rect = intersection(rect, node.getBoundingClientRect());
            }
        }
        node = node.parentElement;
    }
    return rect;
};
const intersection = (rect1, rect2) => {
    const left = Math.max(rect1.left, rect2.left);
    const top = Math.max(rect1.top, rect2.top);
    const right = Math.min(rect1.right, rect2.right);
    const bottom = Math.min(rect1.bottom, rect2.bottom);
    return new DOMRect(left, top, right - left, bottom - top);
};
const getScreenRect = () => {
    return new DOMRect(0, 0, innerWidth, innerHeight);
};
const findLargestImg = () => {
    const sr = getScreenRect();
    let largest = null;
    let largestArea = 0;
    for (const img of document.querySelectorAll("img")) {
        const vr = intersection(sr, img.getBoundingClientRect());
        if (vr.width <= ICON_SIZE || vr.height <= ICON_SIZE)
            continue;
        const r = clipByAncestors(img, vr);
        if (r.width <= ICON_SIZE || r.height <= ICON_SIZE)
            continue;
        const area = r.width * r.height;
        if (area > largestArea) {
            largest = img;
            largestArea = area;
        }
    }
    return largest;
};

const init = () => {
    const img = findLargestImg();
    if (!img) {
        alert("no image");
        return;
    }
    const src = img.currentSrc||img.src;
    const url = VIEWER_URL + "?src=" + encodeURIComponent(src);
    window.open(url, "_blank", "noopener");
};

init();
})();

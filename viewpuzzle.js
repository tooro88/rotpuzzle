javascript:(() => {

/* cut-from */
const DEV_VERSION = true;
/* cut-to */
const ROTPUZZLE_VERSION = "0.1";
const DEFAULT_DIVISION = 6;
const DEFAULT_HAS_BORDER = true;
const BORDER_COLOR = "#555";
const COVER_COLOR = "#bbb";
const BUTTON_OPACITY = 0.7;
const TRANSITION_DURATION = 0.25;
const PIECE_FLASH_DURATION = 0.7;
const BOARD_FLASH_DURATION = 1.7;
const MARGIN_RATIO = 0.05;
const BORDER_RATIO = 0.01;
const BORDER_MIN_PX = 1;
const MAX_PIECES = 9999;
const MAX_DIVISION = 99;
const ICON_SIZE = 70;
const PIECE_MARGIN_PX = 1;
const CLICK_THRESHOLD = 4;

const MAX_Z = 2147483647;
const BIG_Z = MAX_Z - 10;
const COVER_Z = 0;
const PIECE_Z = 1;
const hexCoords = [ [-1, 0], [-0.5,  1], [ 0.5,  1],
                    [ 1, 0], [ 0.5, -1], [-0.5, -1] ];

class Puzzle {
    constructor(img, division, hasBorder) {
        this.img = img;
        this.division = division;
        this.raisedPieces = [];
        this.maxDivision = MAX_DIVISION;
        this.hasBorder = hasBorder;
        this.rotatingPiece = null;
        this.draggingPiece = null;
    }
    startUI() {
        if (!this.img) return "no image";
        this.geom = getImageGeometry(this.img);
        this.imageRect = this.geom.imageRect;
        const screenRect = getScreenRect();
        const vr = this.img.classList.contains("rotpuzzle-target")
                   ? this.geom.viewRect
                   : intersection(screenRect, this.geom.viewRect);
        if (vr.width <= 0 || vr.height <= 0) return "image too small";

        const short = Math.min(vr.width, vr.height);
        const minMargin = short * MARGIN_RATIO;
        this.calcSizes(vr.width  - minMargin * 2,
                       vr.height - minMargin * 2);
        if (this.size < BORDER_MIN_PX * 10) return "image too small";

        const px = (vr.width  - this.puzzleWidth)  / 2;
        const py = (vr.height - this.puzzleHeight) / 2;
        this.imageOffsetX = this.imageRect.left - (vr.left + px);
        this.imageOffsetY = this.imageRect.top  - (vr.top  + py);
        this.rootImageOffsetX = this.imageRect.left - vr.left;
        this.rootImageOffsetY = this.imageRect.top  - vr.top;
        this.root = this.createRootPane(vr);
        this.puzzle = this.createPuzzlePane(px, py);
        this.pieceMargin = this.hasBorder ? PIECE_MARGIN_PX : 0;

        this.slots = [];
        for (const pos of this.genPiecePositions()) {
            const idx = this.slots.length;
            const slot = { idx, pos, piece: null };
            this.slots.push(slot);
            this.createPiece(slot);
        }        
        if (this.slots.length > MAX_PIECES)
            return "too many pieces";

        document.body.appendChild(this.root);
        const panel = this.createUIPanel();
        this.alives = this.visiblePieces(panel);
        for (const p of this.alives) {
            this.drawPiece(p, true);
        }
        this.shuffle();
        this.history = [];
        return null;
    }
    createRootPane(vr) {
        const root = document.createElement("div");
        root.className = "rotpuzzle-root";
        const rx = vr.left + window.scrollX;
        const ry = vr.top  + window.scrollY;
        const url = this.img.currentSrc;
        const ir = this.imageRect;
        const bx = this.rootImageOffsetX;
        const by = this.rootImageOffsetY;
        Object.assign(root.style, {
            position: "absolute",
            left: `${rx}px`,
            top:  `${ry}px`,
            width:  `${vr.width}px`,
            height: `${vr.height}px`,
            backgroundImage: `url("${url}")`,
            backgroundSize: `${ir.width}px ${ir.height}px`,
            backgroundPosition: `${bx}px ${by}px`,
            zIndex: BIG_Z,
            display: "block",
            userSelect: "none",
        });
        for (const name of  ['mousedown', 'mouseup', 'click', 'dblclick',
                             'pointermove', 'pointercancel',
                             'contextmenu',  'pointerdown', 'pointerup',]) {
            root.addEventListener(name, (e) => {
                if (e.target.closest('.rotpuzzle-ui'))
                    return;
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false });
        }
        return root;
    }
    createPuzzlePane(x, y) {
        const puzzle = document.createElement("div");
        Object.assign(puzzle.style, {
            position: "absolute",
            left: `${x}px`,
            top:  `${y}px`,
            width:  `${this.puzzleWidth}px`,
            height: `${this.puzzleHeight}px`,
        });
        this.root.appendChild(puzzle);
        return puzzle;
    }
    calcSizes(w, h) {
        const short = Math.min(w, h);
        const long  = Math.max(w, h);
        const size = short / this.division;
        this.borderPx = Math.max(size * BORDER_RATIO, BORDER_MIN_PX);
        const longCount = Math.floor(long / size);
        const puzzleShort = size * this.division;
        const puzzleLong = size * longCount;

        if (w >= h) {
            this.puzzleWidth = puzzleLong;
            this.puzzleHeight = puzzleShort;
            this.rows = this.division;
            this.cols = longCount;
        } else {
            this.puzzleWidth = puzzleShort;
            this.puzzleHeight = puzzleLong;
            this.rows = longCount;
            this.cols = this.division;
        }
        this.size = size;
        this.hRatio = 1;
        this.vRatio = 1;
        this.vStep = this.size;
        this.hStep = this.size;
    }
    *genPiecePositions() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                yield [col, row];
            }
        }
    }
    showAnswer() {
        this.rotatingPiece = null;
        for (const piece of this.alives) {
            this.setPieceSlot(piece, piece.correctSlot);
            piece.rotation = 0;
            piece.rotated = false;
            jumpPiece(piece);
        }
    }
    shuffle() {
        const slots = this.alives.map(piece => piece.correctSlot);

        const deg = this.rotationDegree();
        const n = 360 / deg;
        const order = derange(this.alives.length);
        this.alives.forEach((piece, i) => {
            const slot = slots[order[i]];
            this.setPieceSlot(piece, slot);
            piece.rotation = Math.floor(Math.random() * n) * deg;
            piece.rotated = false;
            jumpPiece(piece);
        });
        if (this.alives.length === 1 && isCorrect(this.alives[0])) {
            const p = this.alives[0];
            p.rotation = Math.floor(Math.random() * (n - 1)) * deg + deg;
            jumpPiece(p);
        }
    }
    createPiece(slot) {
        const piece = {
            correctSlot: slot,
            rotation: 0,
            rotated: false,
            el: null,
            cover: null,
        };
        this.setPieceSlot(piece, slot);
        return piece;
    }
    drawPiece(piece, alive) {
        if (piece.el)
            piece.el.remove();
        if (piece.cover)
            piece.cover.remove();
        [piece.el, piece.cover] = this.createPieceNode(piece);
        if (alive) {
            this.puzzle.appendChild(piece.cover);
            this.puzzle.appendChild(piece.el);
        }
        Object.assign(piece.cover.style, {
            background: COVER_COLOR,
            zIndex: COVER_Z,
        });
        Object.assign(piece.el.style, {
            cursor: "grab",
            touchAction: "none",
            zIndex: PIECE_Z,
        });
        for (const name of  ['touchstart', 'touchmove',
                             'touchend', 'touchcancel']) {
            piece.el.addEventListener(name, (e) => {
                if (e.target.closest('.rotpuzzle-ui'))
                    return;
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false });
        }
        piece.el.addEventListener("pointerdown", e => {
            this.beginDrag(piece, e);
        });
        piece.el.addEventListener("contextmenu", e => {
            e.preventDefault();
        });
        piece.el.addEventListener("transitionend", e => {
            this.onTransitionEnd(piece, e);
        });
        piece.cover.dataset.slotIdx = piece.correctSlot.idx;
    }
    setPieceSlot(piece, slot) {
        piece.slot = slot;
        slot.piece = piece;
        this.setPiecePos(piece, ...slot.pos);
    }
    setPiecePos(piece, col, row) {
        const left = col * this.hStep;
        const top  = row * this.vStep;
        piece.left = left - this.pieceMargin * this.hRatio;
        piece.top  = top  - this.pieceMargin * this.vRatio;
        piece.cx = left + this.size * this.hRatio / 2;
        piece.cy = top  + this.size * this.vRatio / 2;
    }
    createPieceNode(piece) {
        const size = this.size;
        const border = this.borderPx;
        const ir = this.imageRect;
        const [x, y] = this.correctPos(piece);
        const url = this.img.currentSrc;

        const b = this.hasBorder ? this.borderPx : 0;
        const m = this.pieceMargin;
        const outerSize = this.size + m * 2;
        const innerSize = this.size - b * 2;

        const ix = (m + b) * this.hRatio;
        const iy = (m + b) * this.vRatio;
        const bx = this.imageOffsetX - (x + ix);
        const by = this.imageOffsetY - (y + iy);
        const baseNode  = this.createPieceShape(x, y, outerSize);
        const coverNode = this.createPieceShape(x, y, outerSize);
        let inner;
        if (this.hasBorder) {
            inner = this.createPieceShape(ix, iy, innerSize);
            inner.style.pointerEvents = "none";
            baseNode.appendChild(inner);
            baseNode.style.background = BORDER_COLOR;
        } else {
            inner = baseNode;
        }
        Object.assign(inner.style, {
            backgroundImage: `url("${url}")`,
            backgroundSize: `${ir.width}px ${ir.height}px`,
            backgroundPosition: `${bx}px ${by}px`,
        });
        return [baseNode, coverNode];
    }
    createPieceShape(x, y, size) {
        const node = document.createElement("div");
        Object.assign(node.style, {
            position: "absolute",
            left: `${x}px`,
            top:  `${y}px`,
            width:  `${size}px`,
            height: `${size}px`,
        });
        return node;
    }
    correctPos(piece) {
        const dummy = {};
        this.setPiecePos(dummy, ...piece.correctSlot.pos);
        return [dummy.left, dummy.top];
    }
    findOtherPiece(piece, x, y) {
        const pr = this.puzzle.getBoundingClientRect();
        const sx = x + pr.left;
        const sy = y + pr.top;
        for (const el of document.elementsFromPoint(sx, sy)) {
            if (el === this.puzzle) break;
            if (!("slotIdx" in el.dataset)) continue;
            const idx = Number(el.dataset.slotIdx);
            const p = this.slots[idx].piece;
            return p === piece ? null : p;
        }
        return null;
    }
    onTransitionEnd(piece, ev) {
        this.checkAnswer(piece);
    }
    beginDrag(piece, e) {
        if (this.rotatingPiece === piece && isCorrect(piece))
            /* avoid canceling previous transition who calls checkAnswer() */
            return;
        if (e.button !== 0 && e.button !== 2) return;
        e.preventDefault();
        piece.el.setPointerCapture(e.pointerId);
        this.draggingPiece = piece;

        const [startX, startY] = [e.clientX, e.clientY];
        const [startLeft, startTop] = [piece.left, piece.top];
        const [startCx, startCy] = [piece.cx, piece.cy];
        let moved = false;
        this.lowerPieces();
        piece.el.style.zIndex = BIG_Z;

        piece.el.style.transition = `transform ${TRANSITION_DURATION}s ease`;
        piece.el.style.cursor = "grabbing";

        const move = e => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const new_left = startLeft + dx;
            const new_top  = startTop + dy;
            piece.el.style.left = `${new_left}px`;
            piece.el.style.top = `${new_top}px`;
            if (!moved && Math.abs(dx) + Math.abs(dy) <= CLICK_THRESHOLD)
                return;

            moved = true;
            this.rotatingPiece = null;
            const [cx, cy] = [startCx + dx, startCy + dy];
            const target = this.findOtherPiece(piece, cx, cy);
            if (!target) return;
            this.swapPieces(piece, target);
        };

        const end = e => {
            piece.el.releasePointerCapture(e.pointerId);
            this.draggingPiece = null;
            piece.el.removeEventListener("pointermove", move);
            piece.el.removeEventListener("pointerup", end);
            piece.el.removeEventListener("pointercancel", end);
            piece.el.style.cursor = "grab";

            this.raisePieces([piece]);
            if (!moved) {
                this.rotatePiece(piece, e.button === 2 ? 1 : -1);
                return;
            }
            animatePiece(piece);
        };

        piece.el.addEventListener("pointermove", move);
        piece.el.addEventListener("pointerup", end);
        piece.el.addEventListener("pointercancel", end);
    }
    lowerPieces() {
        for (const p of this.raisedPieces) {
            p.el.style.zIndex = PIECE_Z;
        }
        this.raisedPieces = [];
    }
    raisePieces(pieces) {
        this.lowerPieces();
        let z = BIG_Z - 1;
        for (const p of pieces) {
            p.el.style.zIndex = z--;
            this.raisedPieces.push(p);
        }
    }
    rotationDegree() {
        return 90;
    }
    rotatePiece(piece, direction) {
        this.rotatingPiece = piece;
        piece.rotation += direction * this.rotationDegree();
        piece.rotated = true;
        animatePiece(piece);
    }
    swapPieces(a, b) {
        const a_slot = a.slot;
        this.setPieceSlot(a, b.slot);
        this.setPieceSlot(b, a_slot);
        if (!b.rotated) {
            const deg = this.rotationDegree();
            const dir = Math.random() < 0.5 ? -deg : deg;
            b.rotation += dir;
            if (isCorrect(b))
                b.rotation -= dir * 2;
        }
        this.raisePieces([b]);
        animatePiece(b);
    }
    isAlive(piece) {
        return this.alives.includes(piece);
    }
    checkAnswer(piece) {
        if (!isCorrect(piece)) return;
        if (this.draggingPiece === piece) return;
        if (!this.isAlive(piece)) return;
        flashNode(piece.el, this.puzzle, PIECE_FLASH_DURATION);
        this.addHistory(piece);
        this.clearPiece(piece);
        if (this.alives.length === 0) {
            flashNode(this.puzzle, this.puzzle, BOARD_FLASH_DURATION,
                      () => this.closeUI());
        }
    }
    addHistory(piece) {
        this.history.push(piece);
        this.undoButton.disabled = false;
    }
    undo() {
        if (this.history.length === 0) return;
        this.rotatingPiece = null;
        const piece = this.history.pop();
        this.undoButton.disabled = this.history.length === 0;
        this.puzzle.appendChild(piece.cover);
        this.puzzle.appendChild(piece.el);
        this.alives.push(piece);
        piece.rotated = false;
        flashNode(piece.el, this.puzzle, PIECE_FLASH_DURATION);
    }
    clearPiece(piece) {
        piece.el.remove();
        piece.cover.remove();
        this.alives = this.alives.filter(p => p !== piece);
    }
    getOtherPuzzle() {
        return [HexPuzzle, "⬡"];
    }
    visiblePieces(node) {
        const pr = this.puzzle.getBoundingClientRect();
        const r = node.getBoundingClientRect();
        r.x -= pr.left;
        r.y -= pr.top;
        const pieces = this.slots.map(s => s.piece);
        return pieces.filter(p => {
            return p.cx < r.left || r.right  < p.cx
                || p.cy < r.top  || r.bottom < p.cy;
        });
    }
    createUIPanel() {
        const panel = document.createElement("div");
        panel.className = "rotpuzzle-ui";
        Object.assign(panel.style, {
            position: "absolute",
            right: 0,
            top: 0,
            display: "flex",
            flexDirection: "row",
            pointerEvents: "none",
            zIndex: BIG_Z,
            opacity: BUTTON_OPACITY,
        });
        this.root.appendChild(panel);

        const button = (text, handler) => {
            return createButton(panel, text, handler);
        };

        const [PuzzleClass, buttonText] = this.getOtherPuzzle();
        this.hintButton = button("?", () => this.hint());
        this.undoButton = button("↶", () => this.undo());
        button("◌", () => this.toggleBorder());
        const decButton = button("-", () => this.changeDivision(-1));
        const incButton = button("+", () => this.changeDivision(1));
        button(buttonText, () => this.changeShape(PuzzleClass));
        button("X", () => this.closeUI());

        decButton.disabled = this.division <= 1;
        incButton.disabled = this.division >= this.maxDivision;
        this.undoButton.disabled = true;
        return panel;
    }
    toggleBorder() {
        this.hasBorder = !this.hasBorder;
        this.pieceMargin = this.hasBorder ? PIECE_MARGIN_PX : 0;
        let i = 0;
        for (const s of this.slots) {
            const p = s.piece;
            /* recalc coordinate with new margin */
            this.setPieceSlot(p, p.slot);
        }
        for (const p of this.history) {
            this.drawPiece(p, false);
        }
        for (const p of this.alives) {
            this.drawPiece(p, true);
            jumpPiece(p);
        }
    }
    hint() {
        if (this.hintButton.textContent === "?") {
            this.showAnswer();
            /* \u{1F500}: TWISTED RIGHTWARDS ARROWS */
            this.hintButton.textContent = "\u{1F500}";
        } else {
            this.shuffle();
            this.hintButton.textContent = "?";
        }
    }
    changeShape(puzzleClass) {
        this.closeUI();
        const puzzle = new puzzleClass(this.img, this.division, this.hasBorder);
        const err = puzzle.startUI();
        if (err) alert(err);
    }
    changeDivision(delta) {
        const division = this.division;
        if (division + delta < 1) return;
        this.division += delta;
        this.closeUI();
        if (this.startUI()) {
            this.division = division;
            this.maxDivision = division;
            this.startUI();
        }
    }
    closeUI() {
        this.root.remove();
        this.root = null;
/* cut-from */
        clearMsg();
/* cut-to */
    }
}

class HexPuzzle extends Puzzle {
    rotationDegree() {
        return 60;
    }
    getOtherPuzzle() {
        return [Puzzle, "□"];
    }
    calcSizes(w, h) {
        const short = Math.min(w, h);
        const long  = Math.max(w, h);
        const size2diameter = 2 / Math.sqrt(3);
        let size, puzzleShort;
        if (this.division === 1 && long < short * size2diameter) {
            size = long / size2diameter;
            puzzleShort = size;
        } else {
            size = short / (this.division + 0.5);
            puzzleShort = short;
            const diameter = size * size2diameter;
            if (long < diameter * 7/4)
                size = short / this.division;
        }
        this.borderPx = Math.max(size * BORDER_RATIO, BORDER_MIN_PX);
        const diameter = size * size2diameter;
        const repeatSize = diameter * 3/4;
        const longCount = Math.floor((long - diameter/4) / repeatSize);
        const puzzleLong = repeatSize * longCount + diameter / 4;

        this.size = size;
        if (w >= h) {
            this.isFlat = true;
            this.hexCoords = hexCoords;
            this.vRatio = 1;
            this.hRatio = size2diameter;
            this.vStep = this.size;
            this.hStep = this.size * this.hRatio * 3/4;
            this.puzzleWidth = puzzleLong;
            this.puzzleHeight = puzzleShort;
            this.rows = this.division;
            this.cols = longCount;
        } else {
            this.isFlat = false;
            this.hexCoords = hexCoords.map(([x, y]) => [y, x]);
            this.vRatio = size2diameter;
            this.hRatio = 1;
            this.vStep = this.size * this.vRatio * 3/4;
            this.hStep = this.size;
            this.puzzleWidth = puzzleShort;
            this.puzzleHeight = puzzleLong;
            this.rows = longCount;
            this.cols = this.division;
        }
    }
    *genPiecePositions() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                let colDelta = 0;
                let rowDelta = 0;
                if (this.isFlat && col % 2 === 1)
                    rowDelta = 0.5;
                else if (!this.isFlat && row % 2 === 1)
                    colDelta = 0.5;
                yield [col + colDelta, row + rowDelta];
            }
        }
    }
    createPieceShape(x, y, size) {
        const w = size * this.hRatio;
        const h = size * this.vRatio;
        const node = document.createElement("div");
        const path = this.toPath(this.clipPoints(w, h));
        Object.assign(node.style, {
            position: "absolute",
            left: `${x}px`,
            top: `${y}px`,
            width: `${w}px`,
            height: `${h}px`,
            clipPath: `polygon(${path})`,
        });
        return node;
    }
    toPath(coords) {
        return coords.map(([x, y]) => `${x}px ${y}px`).join(',');
    }
    clipPoints(w, h) {
        const half_w = w / 2;
        const half_h = h / 2;
        return this.hexCoords.map(([x, y]) => {
            return [x * half_w + half_w, y * half_h + half_h];
        });
    }
}
const createButton = (panel, text, handler) => {
    const button = document.createElement("button");
    button.textContent = text;
    Object.assign(button.style, {
        width: "1.5em",
        height: "1.5em",
        padding: 0,
        font: "bold 1em sans-serif",
        lineHeight: 1,
        pointerEvents: "auto",
    });
    button.addEventListener("click", handler);
    panel.appendChild(button);
    return button;
};
const derange = n => {
    if (n === 1) return [0];
    let a;
    do {
        a = [...Array(n).keys()];
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
    } while (a.some((x, i) => x === i));
    return a;
};
const getObjectPosition = (value, available) => {
    if (value.endsWith("%")) {
        return available * parseFloat(value) / 100;
    }
    switch (value) {
    case "left":
    case "top":
        return 0;
    case "center":
        return available / 2;
    case "right":
    case "bottom":
        return available;
    default:
        return parseFloat(value) || 0;
    }
};
const getObjectFitSize = (rect, iw, ih, objectFit) => {
    switch (objectFit) {
    case "contain": {
        const scale = Math.min(rect.width / iw, rect.height / ih);
        return {
            width: iw * scale,
            height: ih * scale,
        };
    }
    case "cover": {
        const scale = Math.max(rect.width / iw, rect.height / ih);
        return {
            width: iw * scale,
            height: ih * scale,
        };
    }
    case "none":
        return {
            width: iw,
            height: ih,
        };
    case "scale-down": {
        const scale = Math.min(1, Math.min(rect.width / iw, rect.height / ih));
        return {
            width: iw * scale,
            height: ih * scale,
        };
    }
    case "fill":
    default:
        return {
            width: rect.width,
            height: rect.height,
        };
    }
};
const getImageRenderer = (img) => {
    if (getComputedStyle(img).opacity !== "0") return null;
    const parent = img.parentElement;
    if (!parent) return null;
    for (const e of parent.children) {
        if (e === img) continue;
        if (getComputedStyle(e).backgroundImage !== "none") {
            return e;
        }
    }
    return null;
};
const getRenderedRect = (renderer, iw, ih) => {
    const rr = renderer.getBoundingClientRect();
    const cs = getComputedStyle(renderer);
    if (cs.backgroundSize !== "cover")
        /* unsupported */
        return rr;
    const scale = Math.max(rr.width / iw, rr.height / ih);
    const width = iw * scale;
    const height = ih * scale;
    const pos = cs.backgroundPosition.trim().split(/\s+/);
    const xpos = pos[0] || "50%";
    const ypos = pos[1] || "50%";
    const x = rr.left + getObjectPosition(xpos, rr.width - width);
    const y = rr.top + getObjectPosition(ypos, rr.height - height);
    return new DOMRect(x, y, width, height);
};
const getContentRect = (img) => {
    const or = img.getBoundingClientRect();
    const s = getComputedStyle(img);
    const bl = parseFloat(s.borderLeftWidth);
    const br = parseFloat(s.borderRightWidth);
    const bt = parseFloat(s.borderTopWidth);
    const bb = parseFloat(s.borderBottomWidth);
    const pl = parseFloat(s.paddingLeft);
    const pr = parseFloat(s.paddingRight);
    const pt = parseFloat(s.paddingTop);
    const pb = parseFloat(s.paddingBottom);
    const x = or.left + bl + pl;
    const y = or.top + bt + pt;
    const w = or.width - bl - br - pl - pr;
    const h = or.height - bt - bb - pt - pb;
    return new DOMRect(x, y, w, h);
};
const getImageGeometry = (img) => {
    const r = getContentRect(img);
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih)
        return { imageRect: r, viewRect: r };
    const renderer = getImageRenderer(img);
    let ir;
    if (renderer) {
        /* X carousel support */
        ir = getRenderedRect(renderer, iw, ih)
    } else {
        const cs = getComputedStyle(img);
        const size = getObjectFitSize(r, iw, ih, cs.objectFit);
        const pos = cs.objectPosition.trim().split(/\s+/);
        const xpos = pos[0] || "50%";
        const ypos = pos[1] || "50%";
        const x = r.left + getObjectPosition(xpos, r.width - size.width);
        const y = r.top + getObjectPosition(ypos, r.height - size.height);
        ir = new DOMRect(x, y, size.width, size.height);
    }
    const vr = clipByAncestors(img, intersection(r, ir));
    return { imageRect: ir, viewRect: vr };
};
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
const isIrregularImg= img => {
    const cs = getComputedStyle(img);
    if (0.0 < cs.opacity && cs.opacity < 1.0)
        /* Exclude reddit underlay img (opacity 0.3).
           X carousel img (opacity 0.0) should not be excluded. */
        return true;
    return false;
};
const findLargestImg = () => {
    const sr = getScreenRect();
    let largest = null;
    let largestArea = 0;
    for (const img of document.querySelectorAll("img")) {
        const vr = intersection(sr, img.getBoundingClientRect());
        if (vr.width <= ICON_SIZE || vr.height <= ICON_SIZE)
            continue;
        if (isIrregularImg(img)) continue;
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
const hookTransition = (node, fun) => {
    for (const evname of ["transitionend", "transitioncancel"]) {
        node.addEventListener(evname, fun);
    }
};
const jumpPiece = piece => {
    animatePiece(piece, true);
};
const animatePiece = (piece, immediate) => {
    const t = TRANSITION_DURATION;
    piece.el.style.transition = immediate ? "none"
      : `transform ${t}s ease, left ${t}s ease, top ${t}s ease`;
    piece.el.style.transform = `rotate(${piece.rotation}deg)`;
    piece.el.style.left = `${piece.left}px`;
    piece.el.style.top  = `${piece.top}px`;
};
const isCorrect = piece => {
    return piece.slot === piece.correctSlot &&
        ((piece.rotation % 360) + 360) % 360 === 0;
};
const flashNode = (node, parent, duration, callback) => {
    const left = node === parent ? "0px" : node.style.left;
    const top  = node === parent ? "0px" : node.style.top;
    const width = node.style.width;
    const height = node.style.height;
    const flash = document.createElement("div");

    Object.assign(flash.style, {
        position: "absolute",
        left: left,
        top: top,
        width: width,
        height: height,
        background: "white",
        pointerEvents: "none",
        opacity: 1,
        zIndex: BIG_Z,
        transition: `opacity ${duration}s ease`,
        clipPath: node.style.clipPath,
    });
    parent.appendChild(flash);
    void flash.offsetWidth;
    flash.style.opacity = "0";
    hookTransition(flash, () => {
        flash.remove();
        if (callback) callback();
    });
};
const clearOld = () => {
    const oldRoots = document.querySelectorAll(".rotpuzzle-root");
    for (const root of oldRoots)
        root.remove();
};
/* cut-from */
const clearMsg = (...args) => {
    if (window.devkit)
        return window.devkit.clearMsg(...args);
};
const msg = (...args) => {
    if (window.devkit)
        return window.devkit.msg(...args);
    else
        console.log(...args);
};
function waitForImage(img) {
    if (img.complete) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", reject, { once: true });
    });
}
const runOnImgs = async (imgs) => {
    await Promise.all([...imgs].map(waitForImage));
    for (const img of imgs) {
        const puzzle = new HexPuzzle(img, DEFAULT_DIVISION, DEFAULT_HAS_BORDER);
        const err = puzzle.startUI();
        if (err) alert(err);
    }
};
const checkParams = () => {
    const params = new URLSearchParams(location.search);
    const src = params.get("src");
    if (!src) return;
    const img = document.querySelector(".rotpuzzle-target");
    img.src = "";
    img.complete = false;
    img.src = src;
};
/* cut-to */
const init = () => {
    clearOld();
/* cut-from */
    checkParams();
    const imgs = document.querySelectorAll(".rotpuzzle-target");
    if (imgs.length) {
        runOnImgs(imgs);
        return;
    }
/* cut-to */
    const img = findLargestImg();
    const puzzle = new HexPuzzle(img, DEFAULT_DIVISION, DEFAULT_HAS_BORDER);
    const err = puzzle.startUI();
    if (err) alert(err);
};

init();
})();

javascript:(()=>{const VERSION="0.4";
const DFLT_SHAPE = 6;
const DFLT_DIVISION = 6;
const DFLT_HAS_WALL = true;

const WALL_COL = "#555";
const COVER_COL = "#bbb";
const FLASH_COL = "white";
const HOVER_COL = "#ccc";
const REJECT_COL = "red";
const JOIN_COL = "blue";
const JOIN_FLASH_COL = "#777";
const BTN_OPACITY = 0.7;

const MOVE_T = 0.25;
const PIECE_FLASH_T = 1.0;
const BOARD_FLASH_T = 1.7;
const WALL_FLASH_T = 1.0;
const JOIN_FLASH_T = 1.5;
const PCS_T = 2.5;

const SQUARE_MARGIN_RATIO = 0.05;
const HEX_MARGIN_RATIO = 0.02;
const WALL_RATIO = 0.01;
const WALL_MIN_PX = 1;
const PIECE_OVLAP_PX = 1;

const MAX_PIECES = 9999;
const MAX_DIVISION = 99;
const ICON_SIZE = 70;
const CLICK_THRESHOLD = 4;

const MAX_Z = 2147483647;
const DRAG_Z = MAX_Z;
const BIG_Z  = MAX_Z - 10;
const WALL_FLASH_Z = MAX_Z - 5;
const COVER_Z = 0;
const PIECE_Z = 1;
const squareCoords = [ [-1, -1], [1, -1], [1, 1], [-1, 1] ];
const hexCoords = [
	[0, -1], [ 1, -0.5], [ 1,  0.5], [0,  1], [-1,  0.5], [-1, -0.5] ];
const squareDirs = [ [0, -1], [1, 0], [0, 1], [-1, 0] ];
const hexDirs = [
	[ 0.5, -1], [ 1, 0], [ 0.5,  1], [-0.5,  1], [-1, 0], [-0.5, -1] ];

class Puzzle {
constructor(img, cfg) {
	this.img = img;
	this.N = cfg.shape;
	this.division = cfg.division;
	this.raisedPieces = [];
	this.maxDivision = MAX_DIVISION;
	this.hasWall = !!cfg.hasWall;
	this.rotatingPiece = null;
}
startUI(showPcs) {
	if (!this.img) throw "no image";
	const geom = imgGeom(this.img);
	if (!this.img.classList.contains("rotpuzzle-target"))
		geom.viewBox = clip(scrBox(), geom.viewBox);

	this.lo = newLayout(this.N);
	if (!this.lo) throw `no such shape: ${this.N}`;
	this.lo.layout(geom, this.division);

	this.root = this.mkRootPane();

	this.slots = [];
	for (const pos of this.lo.genPiecePositions()) {
		const idx = this.slots.length;
		const slot = { idx, pos, piece: null, visible: false,
			       nbors: [], };
		this.slots.push(slot);
		this.mkPiece(slot);
	}
	if (this.slots.length > MAX_PIECES)
		throw "too many pieces";

	document.body.appendChild(this.root);
	const panel = this.mkUIPanel();
	this.alives = this.visiblePieces(panel);
	for (const p of this.alives)
		p.slot.visible = true;
	this.lo.calcAdjacency(this.slots);
	this.mkClipStock();
	for (const p of this.alives) {
		this.drawPiece(p);
	}
	this.shuffle();
	this.history = [];
	if (showPcs)
		this.flashPcs();
}
mkRootPane() {
	const vr = this.lo.viewBox();
	const rx = vr.left + window.scrollX;
	const ry = vr.top + window.scrollY;
	const [ix, iy, iw, ih] = this.lo.imgPos(0, 0);
	const url = this.img.currentSrc;
	const root = mkdiv(rx, ry, vr.width, vr.height, {
		backgroundImage: `url("${url}")`,
		backgroundSize: px(iw, ih),
		backgroundPosition: px(ix, iy),
		zIndex: BIG_Z,
		display: "block",
		userSelect: "none",
	});
	root.className = "rotpuzzle-root";
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
	root.addEventListener("pointerout", (e) => {
		if (e.relatedTarget === this.root)
			this.lastEnterGrp = null;
	});
	return root;
}
showAnswer() {
	this.rotatingPiece = null;
	for (const p of this.alives) {
		this.setPieceSlot(p, p.correctSlot);
		p.rotation = 0;
		p.rotated = false;
		this.jumpPiece(p);
	}
	this.initGrps();
}
shuffle() {
	const slots = this.alives.map(p => p.correctSlot);
	const order = derange(this.alives.length);
	this.alives.forEach((p, i) => {
		const slot = slots[order[i]];
		this.setPieceSlot(p, slot);
		p.rotation = Math.floor(Math.random() * this.N);
		p.rotated = false;
		this.jumpPiece(p);
	});
	if (this.alives.length === 1 && this.isCorrect(this.alives[0])) {
		const p = this.alives[0];
		p.rotation = Math.floor(Math.random() * (this.N - 1)) + 1;
		this.jumpPiece(p);
	}
	this.initGrps();
}
initGrps() {
	for (const p of this.alives)
		this.setGrp(new Set([p]));
}
mkPiece(slot) {
	const p = {
		correctSlot: slot,
		correctNbors: [],
		rotation: 0,
		alive: true,
		rotated: false,
		el: null,
		cover: null,
		inner: null,
	};
	p.grp = new Set([p]);
	this.setPieceSlot(p, slot);
	return p;
}
drawPiece(p) {
	[p.el, p.cover] = this.mkPieceNode(p);
	this.drawWall(p);
	this.root.appendChild(p.cover);
	this.root.appendChild(p.el);
	Object.assign(p.cover.style, {
		background: COVER_COL,
		zIndex: COVER_Z,
	});
	Object.assign(p.el.style, {
		cursor: "grab",
		touchAction: "none",
		zIndex: PIECE_Z,
	});
	for (const name of  ['touchstart', 'touchmove',
			     'touchend', 'touchcancel']) {
		p.el.addEventListener(name, (e) => {
			if (e.target.closest('.rotpuzzle-ui'))
				return;
			e.preventDefault();
			e.stopPropagation();
		}, { passive: false });
	}
	p.el.addEventListener("pointerdown", e => {
		this.beginDrag(p, e);
	});
	p.el.addEventListener("transitionend", e => {
		this.onTransitionEnd(p, e);
	});
	p.el.addEventListener("mouseenter", e => {
		this.onEnter(p);
	});
	p.cover.dataset.slotIdx = p.correctSlot.idx;
}
drawWall(p) {
	p.el.replaceChildren();
	if (!this.hasWall) return;
	for (let i = 0; i < this.N; ++i) {
		const dir = mod(i + p.rotation, this.N);
		if (needWall(p, dir))
			this.addWall(p.el, i, WALL_COL);
	}
}
addWall(el, dir, col) {
	const path = this.wallClips[dir];
	const div = mkdiv(0, 0, el.style.width, el.style.height, {
		backgroundColor: col,
		clipPath: `polygon(${path})`,
		pointerEvents: "none",
	});
	el.appendChild(div);
}
mkClipStock() {
	const ww = this.lo.wallWidth();
	this.wallClips = this.mkWallClips(ww);
}
mkWallClips(ww) {
	return [...Array(this.N).keys()].map(i => this.mkWallClip(i, ww));
}
mkWallClip(dir, ww) {
	const next = mod(dir + 1, this.N);
	const pts = [
		this.lo.wallCoord(dir,  false, false, ww),
		this.lo.wallCoord(next, false, false, ww),
		this.lo.wallCoord(next, true,  false, ww),
		this.lo.wallCoord(dir,  false, true,  ww)
	];
	return toPath(pts);
}
setGrp(grp) {
	for (const p of grp)
		p.grp = grp;
	for (const p of grp)
		this.drawWall(p);
}
setPieceSlot(p, slot) {
	p.slot = slot;
	slot.piece = p;
	this.lo.setPiecePos(p, slot.pos);
}
mkPieceNode(p) {
	const [x, y] = this.correctPos(p);
	const url = this.img.currentSrc;
	const sz = this.lo.pieceSz();
	const [ix, iy, iw, ih] = this.lo.imgPos(x, y);
	const el    = this.lo.mkPieceShape(x, y, sz);
	const cover = this.lo.mkPieceShape(x, y, sz);
	Object.assign(el.style, {
		backgroundImage: `url("${url}")`,
		backgroundSize: px(iw, ih),
		backgroundPosition: px(ix, iy),
	});
	return [el, cover];
}
correctPos(p) {
	const dummy = {};
	this.lo.setPiecePos(dummy, p.correctSlot.pos);
	return [dummy.x, dummy.y];
}
findSlotAt(x, y) {
	const r = getBBox(this.root);
	const sx = x + r.left;
	const sy = y + r.top;
	for (const el of document.elementsFromPoint(sx, sy)) {
		if (el === this.root) break;
		if (!("slotIdx" in el.dataset)) continue;
		const idx = Number(el.dataset.slotIdx);
		return this.slots[idx];
	}
	return null;
}
onTransitionEnd(p, ev) {
	this.checkAnswer(p);
}
onEnter(p) {
	if (this.lastEnterGrp === p.grp) return;
	this.lastEnterGrp = p.grp;
	this.flashWall(p.grp, HOVER_COL);
}
beginDrag(p, e) {
	if (this.rotatingPiece === p && this.isCorrect(p))
		return;
	if (e.button !== 0 && e.button !== 2) return;
	e.preventDefault();
	p.el.setPointerCapture(e.pointerId);
	this.lastDragGrp = new Set();
	let cachedDestSlot = null;
	const [startX, startY] = [e.clientX, e.clientY];
	const [startCx, startCy] = [p.cx, p.cy];
	let moved = false;
	this.lowerPieces();
	const grp = p.grp;
	for (const pp of grp) {
		pp.el.style.zIndex = DRAG_Z;
		pp.el.style.transition = `transform ${MOVE_T}s ease`;
		pp.startX = pp.x;
		pp.startY = pp.y;
	}
	p.el.style.cursor = "grabbing";

	const move = e => {
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		for (const p of grp) {
			p.el.style.left = px(p.startX + dx);
			p.el.style.top  = px(p.startY + dy);
		}
		if (!moved && Math.abs(dx) + Math.abs(dy) <= CLICK_THRESHOLD)
			return;

		moved = true;
		this.rotatingPiece = null;
		const [cx, cy] = [startCx + dx, startCy + dy];
		const slot = this.findSlotAt(cx, cy);
		if (!slot || slot.piece === p || slot === cachedDestSlot)
			return;
		cachedDestSlot = slot;
		this.moveGrp(p, slot);
	};

	const end = e => {
		p.el.releasePointerCapture(e.pointerId);
		p.el.removeEventListener("pointermove", move);
		p.el.removeEventListener("pointerup", end);
		p.el.removeEventListener("pointercancel", end);
		p.el.style.cursor = "grab";
		this.lastDragGrp = new Set(grp);
		this.raisePieces(grp);
		if (!moved) {
			this.rotatePiece(p, e.button === 2 ? 1 : -1);
			return;
		}
		const [ex, ey] = this.clt2root(e.clientX, e.clientY);
		const slot = this.findSlotAt(ex, ey);
		this.lastEnterGrp = slot?.piece?.grp;
		for (const pp of grp)
			this.animatePiece(pp);
	};

	p.el.addEventListener("pointermove", move);
	p.el.addEventListener("pointerup", end);
	p.el.addEventListener("pointercancel", end);
}
clt2root(x, y) {
	const r = getBBox(this.root);
	return [x - r.left, y - r.top];
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
rotatePiece(p, direction) {
	if (p.grp.size > 1) {
		if (this.moveGrp(p, p.slot, direction))
			return;
		this.splitGrp(p);
	}
	this.rotatingPiece = p;
	p.rotation += direction;
	p.rotated = true;
	this.animatePiece(p);
}
moveGrp(p, slot, rotDir=0) {
	for (const pp of p.grp)
		pp.visited = false;
	const backwards = new Map();
	const victims = [];
	if (!this.calcDestDFS(p, slot, p.grp, backwards, victims,
			      rotDir))
		return false;
	if (!rotDir)
		this.raisePieces(victims);
	for (const pp of p.grp)
		pp.visited = false;
	for (const v of victims) {
		v.visited = false;
		this.shiftSlot(v, backwards);
		this.randomRotate(v);
		this.animatePiece(v);
	}
	for (const pp of p.grp)
		this.shiftSlot(pp, backwards);
	if (rotDir) {
		for (const pp of p.grp) {
			pp.rotation += rotDir;
			pp.rotated = true;
			this.animatePiece(pp);
		}
	}
	return true;
}
calcDestDFS(p, slot, grp, backwards, victims, rotDir) {
	if (!slot) return false;
	if (p.visited) return true;
	p.visited = true;
	const pp = slot.piece;
	if (!pp.alive) {
		this.flashDead(pp, rotDir);
		return false;
	}
	backwards.set(slot, p.slot);
	if (grp !== pp.grp) {
		if (pp.grp.size > 1) {
			this.flashWall(pp.grp, REJECT_COL);
			return false;
		}
		victims.push(pp)
	}
	for (let dir = 0; dir < this.N; ++dir) {
		const np = adjPiece(p, dir);
		if (grp !== np?.grp) continue;
		const ns = slot.nbors[mod(dir + rotDir, this.N)];
		if (!this.calcDestDFS(np, ns, grp, backwards, victims, rotDir))
			return false;
	}
	return true;
}
shiftSlot(p, backwards) {
	if (p.visited) return;
	p.visited = true;
	let slot = p.slot;
	while (true) {
		const prevSlot = backwards.get(slot);
		if (!prevSlot) break;
		const pp = prevSlot.piece;
		if (pp.visited) break;
		pp.visited = true;
		this.setPieceSlot(pp, slot);
		slot = prevSlot;
	}
	this.setPieceSlot(p, slot);
}
randomRotate(p) {
	if (p.rotated && !this.isCorrect(p))
		return;
	const dir = Math.random() < 0.5 ? -1 : 1;
	p.rotation += dir;
	if (this.isCorrect(p))
		p.rotation -= dir * 2;
	p.rotated = false;
}
swapPieces(a, b) {
	const a_slot = a.slot;
	this.setPieceSlot(a, b.slot);
	this.setPieceSlot(b, a_slot);
	if (!b.rotated || this.isCorrect(b)) {
		const dir = Math.random() < 0.5 ? -1 : 1;
		b.rotation += dir;
		if (this.isCorrect(b))
			b.rotation -= dir * 2;
		b.rotated = false;
	}
	this.raisePieces([b]);
	this.animatePiece(b);
}
isAlive(p) {
	return p.alive;
}
checkAnswer(p) {
	if (!this.isCorrect(p)) {
		this.checkJoin(p);
		return;
	}
	if (!this.isAlive(p)) return;
	flashNode(p.el, this.root);
	this.addHistory(p);
	this.clearPiece(p);
	if (this.alives.length === 0) {
		flashNode(this.root, this.root,
			  { t: BOARD_FLASH_T, cb: ()=>this.closeUI() });
	}
}
checkJoin(p) {
	if (!this.lastDragGrp.has(p)) return;
	const nps = this.findCorrectNbors(p);
	if (nps.length === 0) return;
	const grp = new Set(p.grp);
	for (const np of nps) {
		for (const nnp of np.grp) {
			grp.add(nnp);
		}
	}
	this.setGrp(grp);
	this.joinFlash(grp);
}
joinFlash(grp) {
	this.flashWall(grp, JOIN_COL);
	for (const p of grp)
		flashNode(p.el, this.root,
			  { col: JOIN_FLASH_COL, t: JOIN_FLASH_T });
}
splitGrp(p) {
	const grp = p.grp;
	grp.delete(p);
	this.setGrp(new Set([p]));
	for (const pp of grp) {
		pp.visited = false;
	}
	const newGrps = [];
	for (let dir = 0; dir < this.N; ++dir) {
		const newGrp = new Set();
		this.splitDFS(adjPiece(p, dir), grp, newGrp);
		this.setGrp(newGrp);
		newGrps.push(newGrp);
	}
	for (const ng of newGrps) {
		if (ng.size > 0)
			this.flashWall(grp, JOIN_COL);
	}
}
splitDFS(p, grp, newGrp) {
	if (!p || p.visited) return;
	p.visited = true;
	if (grp !== p.grp) return;
	newGrp.add(p);
	for (let dir = 0; dir < this.N; ++dir) {
		const pp = adjPiece(p, dir);
		this.splitDFS(pp, grp, newGrp);
	}
}
flashDead(p, rotDir) {
	if (!rotDir) return;
	this.flashWall1(p, REJECT_COL, WALL_FLASH_T, true);
}
flashWall(grp, col, duration=WALL_FLASH_T) {
	for (const p of grp)
		this.flashWall1(p, col, duration);
}
flashWall1(p, col, duration, allWall) {
	const s = p.el.style;
	const div = mkdiv(s.left, s.top, s.width, s.height, {
		pointerEvents: "none",
		zIndex: WALL_FLASH_Z,
	});
	for (let dir = 0; dir < this.N; ++dir) {
		if (allWall || needWall(p, dir))
			this.addWall(div, dir, col);
	}
	this.root.appendChild(div);
	kickFlash(div, duration);
}
findCorrectNbors(p) {
	const N = this.N;
	const ans = [];
	for (let i = 0; i < N; ++i) {
		const np = adjPiece(p, i);
		if (!np?.alive) continue;
		if (p.grp === np.grp) continue;
		const cp = p.correctNbors[mod(i - p.rotation, N)];
		if (np === cp && mod(np.rotation, N) === mod(p.rotation, N))
			ans.push(np);
	}
	return ans;
}
addHistory(p) {
	this.history.push(p);
	this.undoBtn.disabled = false;
}
undo() {
	if (this.history.length === 0) return;
	this.rotatingPiece = null;
	const p = this.history.pop();
	this.undoBtn.disabled = this.history.length === 0;
	this.root.appendChild(p.cover);
	this.root.appendChild(p.el);
	p.alive = true;
	this.alives.push(p);
	p.rotated = false;
	this.drawWall(p);
	flashNode(p.el, this.root);
}
clearPiece(p) {
	this.ungroup(p);
	p.el.remove();
	p.cover.remove();
	p.alive = false;
	this.alives = this.alives.filter(pp => pp !== p);
}
ungroup(p) {
	for (const pp of p.grp) {
		this.setGrp(new Set([pp]));
	}
}
visiblePieces(node) {
	const rr = getBBox(this.root);
	const r = getBBox(node);
	r.x -= rr.left;
	r.y -= rr.top;
	const pieces = this.slots.map(s => s.piece);
	return pieces.filter(p => {
		return p.cx < r.left || r.right  < p.cx
			|| p.cy < r.top  || r.bottom < p.cy;
	});
}
jumpPiece(p) {
	this.animatePiece(p, true);
}
animatePiece(p, immediate) {
	const t = MOVE_T;
	p.el.style.transition = immediate ? "none"
		: `transform ${t}s ease, left ${t}s ease, top ${t}s ease`;
	const deg = p.rotation * 360 / this.N;
	p.el.style.transform = `rotate(${deg}deg)`;
	p.el.style.left = px(p.x);
	p.el.style.top  = px(p.y);
}
isCorrect(p) {
	return p.slot === p.correctSlot &&
		mod(p.rotation, this.N) === 0;
}
mkUIPanel() {
	const panel = mkdiv(null, 0, null, null, {
		right: 0,
		display: "flex",
		flexDirection: "row",
		pointerEvents: "none",
		zIndex: BIG_Z,
		opacity: BTN_OPACITY,
	});
	panel.className = "rotpuzzle-ui";
	this.root.appendChild(panel);
	const btn = (text, handler) => mkBtn(panel, text, handler);
	const [shape, btnText] = this.lo.getOtherPuzzle();

	this.hintBtn = btn("?", () => this.hint());
	this.undoBtn = btn("↶", () => this.undo());
	btn("◌", () => this.toggleWall());
	const decBtn = btn("-", () => this.chgDivision(-1));
	const incBtn = btn("+", () => this.chgDivision(1));
	btn(btnText, () => this.chgShape(shape));
	btn("X", () => this.closeUI());

	decBtn.disabled = this.division <= 1;
	incBtn.disabled = this.division >= this.maxDivision;
	this.undoBtn.disabled = true;
	return panel;
}
toggleWall() {
	this.hasWall = !this.hasWall;
	for (const p of this.alives)
		this.drawWall(p);
}
hint() {
	if (this.hintBtn.textContent === "?") {
		this.showAnswer();
		/* \u{1F500}: TWISTED RIGHTWARDS ARROWS */
		this.hintBtn.textContent = "\u{1F500}";
	} else {
		this.shuffle();
		this.hintBtn.textContent = "?";
	}
	this.flashPcs();
}
chgShape(shape) {
	this.closeUI();
	const cfg = { division: this.division, hasWall: this.hasWall, shape };
	const puzzle = new Puzzle(this.img, cfg);
	try {
		puzzle.startUI();
	} catch (e) {
		if (typeof e !== "string") throw e;
		alert(e);
	}
}
chgDivision(delta) {
	const division = this.division;
	if (division + delta < 1) return;
	this.division += delta;
	this.closeUI();
	try {
		this.startUI(true);
	} catch (e) {
		if (typeof e !== "string") throw e;
		this.division = division;
		this.maxDivision = division;
		this.startUI(true);
	}
}
flashPcs() {
	const vr = this.lo.viewBox();
	const pcs = this.alives.length;
	const [w, h] = [vr.width * 2/3, vr.height * 2/3];
	const div = mkText(`${pcs} pcs`, w, h, "white");
	div.style.zIndex = MAX_Z;
	div.style.pointerEvents = "none";
	this.root.appendChild(div);
	kickFlash(div, PCS_T);
}
closeUI() {
	this.root.remove();
}
}
const newLayout = n => {
	if (n === 4) return new Square();
	if (n === 6) return new Hex();
	return null;
};
class Layout {
layout(geom, division) {
	const vr = geom.viewBox;
	this.imgBox = geom.imgBox;
	this.vBox = vr;
	if (vr.width <= 0 || vr.height <= 0) throw "image too small";

	const minMargin = this.minMargin();
	this.layoutShape(vr.width  - minMargin * 2, vr.height - minMargin * 2, division);
	if (this.sz < WALL_MIN_PX * 10) throw "image too small";

	this.areaX = (vr.width  - this.areaW) / 2;
	this.areaY = (vr.height - this.areaH) / 2;
	this.imgOffset = [this.imgBox.left - vr.left, this.imgBox.top  - vr.top];
	this.wallPx = Math.max(this.sz * WALL_RATIO, WALL_MIN_PX);
	this.ovlapPx = PIECE_OVLAP_PX;
}
imgPos(x, y) {
	const [ix, iy] = this.imgOffset;
	return [ix - x, iy - y, this.imgBox.width, this.imgBox.height];
}
setPiecePos(p, pos) {
	const [col, row] = pos;
	const x = this.areaX + col * this.sz;
	const y  = this.areaY + row * this.vStep;
	p.x  = x - this.ovlapPx;
	p.y  = y - this.ovlapPx * this.vRatio;
	p.cx = x + this.sz / 2;
	p.cy = y + this.sz * this.vRatio / 2;
}
wallCoord(vertex, hasL, hasR, wallW) {
	const sz = this.sz + this.ovlapPx * 2;
	const w = sz / 2;
	const h = sz * this.vRatio / 2;
	const bw = wallW;
	const bh = wallW * this.vRatio;
	const pts = this.shapeCoords();
	let [x, y] = pts[vertex];
	const [lx, ly] = pts[mod(vertex - 1, this.N)];
	const [rx, ry] = pts[mod(vertex + 1, this.N)];
	const k = this.edgeVecCoeff();
	const [dlx, dly] = [(lx - x) * k, (ly - y) * k];
	const [drx, dry] = [(rx - x) * k, (ry - y) * k];
	x *= w;
	y *= h;
	if (hasL) {
		x += drx * bw;
		y += dry * bh;
	}
	if (hasR) {
		x += dlx * bw;
		y += dly * bh;
	}
	return [x + w, y + h];
}
calcAdjacency(slots) {
	const pos2slot = new Map;
	for (const slot of slots) {
		pos2slot.set(JSON.stringify(slot.pos), slot);
	}
	for (const slot of slots) {
		const p = slot.piece;
		const [col, row] = slot.pos;
		for (let dir = 0; dir < this.N; ++dir) {
			const [dcol, drow] = this.dirToDelta(dir);
			const npos = [col + dcol, row + drow];
			const s = pos2slot.get(JSON.stringify(npos));
			slot.nbors[dir] = s?.visible ? s : null;
			p.correctNbors[dir] = s?.visible ? s.piece : null;
		}
	}
}
viewBox() { return this.vBox; };
pieceSz() { return this.sz + this.ovlapPx * 2; };
wallWidth() { return this.ovlapPx + this.wallPx; }
};
class Square extends Layout {
constructor() { super(); this.N = 4; }
layoutShape(w, h, division) {
	const short = Math.min(w, h);
	const long  = Math.max(w, h);
	const sz = short / division;
	const longCount = Math.floor(long / sz);
	const areaShort = sz * division;
	const areaLong = sz * longCount;
	if (w >= h) {
		this.areaW = areaLong;
		this.areaH = areaShort;
		this.rows = division;
		this.cols = longCount;
	} else {
		this.areaW = areaShort;
		this.areaH = areaLong;
		this.rows = longCount;
		this.cols = division;
	}
	this.sz = sz;
	this.vRatio = 1;
	this.vStep = sz;
}
*genPiecePositions() {
	for (let row = 0; row < this.rows; row++) {
		for (let col = 0; col < this.cols; col++) {
			yield [col, row];
		}
	}
}
minMargin() {
	const short = Math.min(this.vBox.width, this.vBox.height);
	return short * SQUARE_MARGIN_RATIO;
}
getOtherPuzzle() { return [6, "⬡"]; }
dirToDelta(dir) { return squareDirs[dir]; }
shapeCoords() { return squareCoords; }
wallOffsets() { return squareWallOffsets; }
mkPieceShape(x, y, sz) { return mkdiv(x, y, sz, sz); }
edgeVecCoeff() { return 0.5; }
}
class Hex extends Layout{
constructor() { super(); this.N = 6; }
getOtherPuzzle() { return [4, "□"]; }
dirToDelta(dir) { return hexDirs[dir]; }
shapeCoords() { return hexCoords; }
wallOffsets() { return hexWallOffsets; }
edgeVecCoeff() { return 1; }
minMargin() {
	const short = Math.min(this.vBox.width, this.vBox.height);
	return short * HEX_MARGIN_RATIO;
}
layoutShape(w, h, division) {
	this.vRatio = 2 / Math.sqrt(3);
	const hSz = w / (division + 0.5);
	const vRep = h / (division + 1/3);
	const vSz = vRep * 4/3 / this.vRatio;
	let sz = Math.min(hSz, vSz);
	const diam = sz * this.vRatio;
	const rep = diam * 3/4;
	if (hSz < vSz) {
		this.cols = division;
		this.rows = Math.floor((h - diam/4) / rep);
	} else {
		this.rows = division;
		this.cols = Math.floor((w - sz/2) / sz);
	}
	this.areaW = sz * (this.cols + 0.5);
	this.areaH = rep * this.rows + diam / 4;
	this.vStep = sz * this.vRatio * 3/4;
	this.sz = sz;
}
*genPiecePositions() {
	for (let row = 0; row < this.rows; row++) {
		for (let col = 0; col < this.cols; col++) {
			const d = row % 2 ? 0.5 : 0;
			yield [col + d, row];
		}
	}
}
mkPieceShape(x, y, sz) {
	const w = sz;
	const h = sz * this.vRatio;
	const path = toPath(this.clipPoints(w, h));
	const node = mkdiv(x, y, w, h, {
		clipPath: `polygon(${path})`,
	});
	return node;
}
clipPoints(w, h) {
	const hw = w / 2;
	const hh = h / 2;
	return this.shapeCoords().map(([x, y]) => {
		return [x * hw + hw, y * hh + hh];
	});
}
}
const mkBtn = (panel, text, handler) => {
	const btn = document.createElement("button");
	btn.textContent = text;
	Object.assign(btn.style, {
		width: "1.5em",
		height: "1.5em",
		padding: 0,
		font: "bold 1em sans-serif",
		lineHeight: 1,
		pointerEvents: "auto",
	});
	btn.addEventListener("click", handler);
	panel.appendChild(btn);
	return btn;
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
const calcObjPos = (val, avail) => {
	if (val.endsWith("%")) {
		return avail * parseFloat(val) / 100;
	}
	return parseFloat(val) || 0;
};
const calcObjFit = (rect, iw, ih, fit) => {
	const scale = {
		contain: Math.min(rect.width / iw, rect.height / ih),
		cover:   Math.max(rect.width / iw, rect.height / ih),
		none: 1,
		"scale-down":
		  Math.min(1, Math.min(rect.width / iw, rect.height / ih))
	}[fit];
	if (scale) return { w: iw * scale, h: ih * scale };
	return { w: rect.width, h: rect.height };
};
const getXRenderer = (img) => {
	if (getCS(img).opacity !== "0") return null;
	const parent = img.parentElement;
	if (!parent) return null;
	for (const e of parent.children) {
		if (e === img) continue;
		if (getCS(e).backgroundImage !== "none") {
			return e;
		}
	}
	return null;
};
const getXRenderBox = (renderer, iw, ih) => {
	const rr = getBBox(renderer);
	const cs = getCS(renderer);
	if (cs.backgroundSize !== "cover")
		/* unsupported */
		return rr;
	const scale = Math.max(rr.width / iw, rr.height / ih);
	const width = iw * scale;
	const height = ih * scale;
	const pos = cs.backgroundPosition.trim().split(/\s+/);
	const xpos = pos[0] || "50%";
	const ypos = pos[1] || "50%";
	const x = rr.left + calcObjPos(xpos, rr.width - width);
	const y = rr.top + calcObjPos(ypos, rr.height - height);
	return new DOMRect(x, y, width, height);
};
const contentBox = (img) => {
	const or = getBBox(img);
	const s = getCS(img);
	const [bl, br, bt, bb, pl, pr, pt, pb] = [
		s.borderLeftWidth, s.borderRightWidth,
		s.borderTopWidth, s.borderBottomWidth,
		s.paddingLeft, s.paddingRight, s.paddingTop, s.paddingBottom
	].map(parseFloat);
	const x = or.left + bl + pl;
	const y = or.top + bt + pt;
	const w = or.width - bl - br - pl - pr;
	const h = or.height - bt - bb - pt - pb;
	return new DOMRect(x, y, w, h);
};
const imgGeom = (img) => {
	const r = contentBox(img);
	const iw = img.naturalWidth;
	const ih = img.naturalHeight;
	if (!iw || !ih)
		return { imgBox: r, viewBox: r };
	const renderer = getXRenderer(img);
	let ir;
	if (renderer) {
		/* X carousel support */
		ir = getXRenderBox(renderer, iw, ih)
	} else {
		const cs = getCS(img);
		const sz = calcObjFit(r, iw, ih, cs.objectFit);
		const pos = cs.objectPosition.trim().split(/\s+/);
		const xpos = pos[0] || "50%";
		const ypos = pos[1] || "50%";
		const x = r.left + calcObjPos(xpos, r.width - sz.w);
		const y = r.top + calcObjPos(ypos, r.height - sz.h);
		ir = new DOMRect(x, y, sz.w, sz.h);
	}
	const vr = clipByParents(img, clip(r, ir));
	return { imgBox: ir, viewBox: vr };
};
const clipByParents = (img, rect) => {
	let node = img.parentElement;
	while (node) {
		if (node !== document.scrollingElement) {
			const cs = getCS(node);
			if (cs.overflowX !== "visible" ||
			    cs.overflowY !== "visible") {
				rect = clip(rect, getBBox(node));
			}
		}
		node = node.parentElement;
	}
	return rect;
};
const clip = (rect1, rect2) => {
	const l = Math.max(rect1.left, rect2.left);
	const t = Math.max(rect1.top, rect2.top);
	const r = Math.min(rect1.right, rect2.right);
	const b = Math.min(rect1.bottom, rect2.bottom);
	const w = Math.max(r - l, 0);
        const h = Math.max(b - t, 0);
	return new DOMRect(l, t, w, h);
};
const scrBox = () => {
	return new DOMRect(0, 0, innerWidth, innerHeight);
};
const isFakeImg= img => {
	const cs = getCS(img);
	if (0.0 < cs.opacity && cs.opacity < 1.0)
		/* Exclude reddit underlay img (opacity 0.3).
		   X carousel img (opacity 0.0) should not be excluded. */
		return true;
	return false;
};
const findLargestImg = () => {
	const sr = scrBox();
	let largest = null;
	let largestArea = 0;
	for (const img of document.querySelectorAll("img")) {
		const vr = clip(sr, getBBox(img));
		if (isFakeImg(img)) continue;
		const r = clipByParents(img, vr);
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
const flashNode = (node, parent, { col=FLASH_COL,
				   t=PIECE_FLASH_T,
				   cb=null }={}) => {
	const x = node === parent ? "0px" : node.style.left;
	const y = node === parent ? "0px" : node.style.top;
	const el = mkdiv(x, y, node.style.width, node.style.height, {
		background: col,
		pointerEvents: "none",
		zIndex: BIG_Z,
		clipPath: node.style.clipPath,
	});
	parent.appendChild(el);
	kickFlash(el, t);
	hookTransition(el, () => {
		if (cb) cb();
	});
};
const kickFlash = (el, t) => {
	el.style.transition = `opacity ${t}s ease`;
	void el.offsetWidth;
	el.style.opacity = "0";
	hookTransition(el, () => el.remove());
};
const mkText = (text, w, h, col) => {
	let sz = Math.min(w, h);
	const div = mkdiv(0, 0, null, null, {
		fontFamily: "sans-serif",
		fontSize: px(sz),
		color: col,
		whiteSpace: "nowrap" });
	div.textContent = text;
	document.body.appendChild(div);
	while ((div.scrollWidth > w || div.scrollHeight > h) && sz > 1) {
		sz -= 1;
		div.style.fontSize = px(sz);
	}
	div.remove();
	return div;
};
const clearOld = () => {
	const oldRoots = document.querySelectorAll(".rotpuzzle-root");
	for (const root of oldRoots)
		root.remove();
};
const adjPiece = (p, dir) => {
	return p.slot.nbors[dir]?.piece ?? null;
};
const needWall = (p, dir) => {
	return adjPiece(p, dir)?.grp !== p.grp;
};
const px1 = val => {
	return typeof val === 'string' ? val : val + "px";
};
const px = (...vals) => {
	return vals.map(px1).join(" ");
};
const mkdiv = (x, y, w, h, style={}) => {
	const el = document.createElement("div");
	Object.assign(el.style, {
		position: "absolute",
		left: px(x), top: px(y),
		width: px(w), height: px(h) });
	Object.assign(el.style, style);
	return el;
};
const getBBox = el => { return el.getBoundingClientRect(); };
const getCS = getComputedStyle;
const mod = (m, n) => {
	return ((m % n) + n) % n;
};
const toPath = (coords) => {
	return coords.map(([x, y]) => `${x}px ${y}px`).join(',');
};
const dfltCfg = () => {
	const cfg = { shape: DFLT_SHAPE, division: DFLT_DIVISION, hasWall: DFLT_HAS_WALL };
	return cfg;
};
const init = () => {
	clearOld();
	const img = findLargestImg();
	const puzzle = new Puzzle(img, dfltCfg());
	try {
		puzzle.startUI();
	} catch (e) {
		if (typeof e !== "string") throw e;
		alert(e);
	}
};
init();
})()

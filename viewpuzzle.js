javascript:(()=>{const VERSION='0.6';
/* cut-from */
const DEV_VERSION = true;
/* cut-to */
//
// このファイルは、固定ページから読み込まれるファイル(viewpuzzle.js)と
// bookmarkletとしてコピーされるファイル(rotpuzzle.bookmarklet.js)の両
// 方を兼ねる。bookmarkletのサイズには32kバイトの制限があるため、
// 以下のように内容を削除したものを用いる。
//   - 各行の // 以降の部分を削除する。
//   - /* cut-from */ から /* cut-to */ までの行を削除する。
// 次の機能が削除される。
//   - URLパラメータの読み書き
//   - 画像読み込み待ち
//   - 画像の縦横の向き切り換え
//   - コメント

const DFLT_SHAPE = 6;
const DFLT_DIVISION = 6;
const DFLT_HAS_WALL = true;
const DFLT_WALL_W = 1;

const WALL_COL = "#555";
const COVER_COL = "#bbb";
const FLASH_COL = "white";
const HOVER_COL = "#ccc";
const JOIN_COL = "blue";
const JOIN_FLASH_COL = "#777";
const WARN_COL = "red";
const BTN_OPACITY = 0.7;
const WARN_OPACITY = 0.2;

const MOVE_T = 0.25;
const PIECE_FLASH_T = 1.0;
const ROOT_FLASH_T = 1.7;
const WALL_FLASH_T = 1.0;
const JOIN_FLASH_T = 1.5;
const PCS_T = 2.5;
const WARN_T = 1.5;

const SQUARE_MARGIN_RATIO = 0.05;
const HEX_MARGIN_RATIO = 0.02;
const OVLAP_PX = 1;
const WALL_FLASH_MULT = 2;
const TOUCH_FONT_SIZE = "28px";
const FONT_SIZE = "18px";

const MAX_PIECES = 9999;
const MAX_DIVISION = 99;
const ICON_SIZE = 70;
const CLICK_LIMIT = 4;

const MAX_Z = 2147483647;
const DRAG_Z = MAX_Z;
const BIG_Z  = MAX_Z - 10;
const WALL_FLASH_Z = MAX_Z - 5;
const PIECE_Z = 3;
const COVER_Z = 2;
const ROOT_WARN_Z = 1;
const squarePts = [ [-1, -1], [1, -1], [1, 1], [-1, 1] ];
const hexPts = [[0, -1], [1, -0.5], [1, 0.5], [0, 1], [-1, 0.5], [-1, -0.5]];
const squareDirs = [ [0, -1], [1, 0], [0, 1], [-1, 0] ];
const hexDirs = [[ 0.5, -1], [1, 0], [0.5, 1], [-0.5, 1], [-1, 0], [-0.5, -1]];
const touchEvs = "touchstart|touchmove|touchend|touchcancel".split("|");
const ptrEvs = ("mousedown|mouseup|click|dblclick|pointermove|pointercancel|"
		+ "contextmenu|pointerdown|pointerup").split("|");

class Puzzle {
constructor(img, cfg, frame) {
	this.img = img;
	this.N = cfg.shape;
	this.division = cfg.division;
	this.raisedPieces = [];
	this.maxDivision = MAX_DIVISION;
	this.hasWall = !!cfg.hasWall;
	this.wallW = cfg.wallW;
	this.rotatingPiece = null;
	this.shuff = !!cfg.shuff;
	this.frame = frame;
/* cut-from */
	this.orient = cfg.orient;
/* cut-to */
}
startUI(showPcs) {
	if (!this.img) throw "no image";
	this.lo = newLayout(this.N);
	if (!this.lo) throw `no such shape: ${this.N}`;

	this.lo.layout(this.img, this.division, this.frame, this.orient);

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

	this.root = this.mkRoot();
	const panel = this.mkUIPanel();
	this.alives = this.visibles(panel);
	for (const p of this.alives)
		p.slot.visible = true;
	this.lo.setAdj(this.slots);
	this.initWallClips();
	for (const p of this.alives)
		this.drawPiece(p);
	if (this.shuff)
		this.shuffle();
	this.hist = [];
/* cut-from */
	setUrlParam("shape", this.N);
	setUrlParam("division", this.division);
	setUrlParam("hasWall", this.hasWall ? 1 : 0);
	setUrlParam("wallW", this.wallW);
	setUrlParam("orient", this.orient);
	if (!this.shuff)
		setUrlParam("shuff", 0);
/* cut-to */
	if (showPcs)
		this.flashPcs();
	this.enableResize();
}
redraw() {
	this.closeUI();
	this.lo.layout(this.img, 0, this.frame, this.orient);
	this.root = this.mkRoot();
	this.mkUIPanel();
	this.initWallClips();
	for (const p of this.alives) {
		this.drawPiece(p);
		this.setPieceSlot(p, p.slot); // re-calc p.x, p.y
		this.jumpPiece(p);
	}
	this.enableResize();
}
mkRoot() {
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
	ignoreEvs(root, ptrEvs);
	hook(root, "pointerout", e => {
		if (e.relatedTarget === this.root)
			// 盤のマージンまたは正解済みスロットに入った。
			// 次のenterで前回フラッシュしたグループに入っ
			// てもフラッシュさせる。
			this.flashedGrp = null;
	});
	document.body.appendChild(root);
/* cut-from */
	if (this.orient) {
		root.remove();
		root.style.left = 0;
		root.style.top = 0;
		this.frame.el.appendChild(root);
	}
/* cut-to */
	return root;
}
showAnswer() {
	// 回転連打で正解位置を通り過ぎてしまうのを防ぐため、最後に回
	// 転したピースが正解位置にあると、それ以上動かせない。それを
	// キャンセル。
	this.rotatingPiece = null;
	for (const p of this.alives) {
		this.setPieceSlot(p, p.okSlot);
		p.rot = 0;
		p.rotated = false;
		this.jumpPiece(p);
	}
	this.initGrps();
}
shuffle() {
	const slots = this.alives.map(p => p.okSlot);
	const order = derange(this.alives.length);
	this.alives.forEach((p, i) => {
		const slot = slots[order[i]];
		this.setPieceSlot(p, slot);
		p.rot = Math.floor(Math.random() * this.N);
		p.rotated = false;
		this.jumpPiece(p);
	});
	if (this.alives.length === 1 && this.isOk(this.alives[0])) {
		const p = this.alives[0];
		p.rot = Math.floor(Math.random() * (this.N - 1)) + 1;
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
		okSlot: slot,
		okNbors: [],
		rotation: 0,
		alive: true,
		rotated: false,
		el: null,
		cover: null,
		inner: null,
	};
	// Can't call setGrp() here. It calls drawWall() who requires nodes.
	p.grp = new Set([p]);
	this.setPieceSlot(p, slot);
	return p;
}
drawPiece(p) {
	p.el?.remove();
	p.cover?.remove();
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
	ignoreEvs(p.el, touchEvs);
	hook(p.el, "pointerdown", e => this.beginDrag(p, e));
	hook(p.el, "transitionend", e => this.onTransitionEnd(p, e));
	hook(p.el, "mouseenter", e => this.onEnter(p));
	p.cover.dataset.slotIdx = p.okSlot.idx;
}
drawWall(p) {
	p.el.replaceChildren();
	if (!this.hasWall) return;
	for (let i = 0; i < this.N; ++i) {
		const dir = mod(i + p.rot, this.N);
		if (needWall(p, dir))
			this.addWall(p.el, i, WALL_COL);
	}
}
addWall(el, dir, col, mult=1) {
	const w = OVLAP_PX + this.wallW * mult;
	const path = this.getWallClips(w)[dir];
	const div = mkdiv(0, 0, el.style.width, el.style.height, {
		backgroundColor: col,
		clipPath: `polygon(${path})`,
		pointerEvents: "none",
	});
	el.appendChild(div);
}
initWallClips() {
	this.wallClips = new Map();
}
getWallClips(w) {
	if (!this.wallClips.has(w))
		this.wallClips.set(w, this.mkWallClips(w));
	return this.wallClips.get(w);
}
mkWallClips(ww) {
	return [...Array(this.N).keys()].map(i => this.mkWallClip(i, ww));
}
mkWallClip(dir, ww) {
	const next = mod(dir + 1, this.N);
	const pts = [
		this.lo.wallPts(dir,  false, false, ww),
		this.lo.wallPts(next, false, false, ww),
		this.lo.wallPts(next, true,  false, ww),
		this.lo.wallPts(dir,  false, true,  ww)
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
	const [x, y] = this.okPos(p);
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
okPos(p) {
	const dummy = {};
	this.lo.setPiecePos(dummy, p.okSlot.pos);
	return [dummy.x, dummy.y];
}
findSlotAt(x, y) {
	const r = getBBox(this.root);
	let sx = x + r.left;
	let sy = y + r.top;
/* cut-from */
	const ir = getBBox(this.img);
	if (this.orient) {
		sx = ir.width - y + r.left
		sy = x + r.top;
	}
/* cut-to */
	for (const el of document.elementsFromPoint(sx, sy)) {
		if (el === this.root) break;
		if (!("slotIdx" in el.dataset)) continue;
		const idx = Number(el.dataset.slotIdx);
		return this.slots[idx];
	}
	return null;
}
onTransitionEnd(p, ev) {
	this.chkOk(p);
}
onEnter(p) {
	// 同じグループ内のピースの境界をまたいだときにフラッシュが発
	// 生しないようにするためのチェック。
	if (this.flashedGrp === p.grp) return;
	this.flashedGrp = p.grp;
	this.flashWall(p.grp, HOVER_COL);
}
beginDrag(p, e) {
	if (this.rotatingPiece === p && this.isOk(p))
		// 回転連打でも正解判定が出るようにしたい。このまま進
		// むと回転transitionがキャンセルされてchkOk()が呼ばれ
		// ない。かと言ってこの場でchkOk()を呼ぶとアニメーショ
		// ンなしで見た目に不思然。
		return;
	if (![0, 2].includes(e.button)) return;
	e.preventDefault();
	p.el.setPointerCapture(e.pointerId);
	// ユーザーが操作したグループ。どかされて動いたピースが移動先
	// でまぐれで連結しないための判定用。
	this.curGrp = new Set();
	// ドラッグ/回転の失敗理由。現状"root"のみ。
	this.failFor = null;
	// 現在いるslot。同じslotでmoveGrpを2回呼ばないため。
	let curSlot = null;
	const [begX, begY] = this.tr(e.clientX, e.clientY);
	const [begCx, begCy] = [p.cx, p.cy];
	let moved = false;
	this.lowerPieces();
	const grp = p.grp;
	for (const pp of grp) {
		pp.el.style.zIndex = DRAG_Z;
		pp.el.style.transition = `transform ${MOVE_T}s ease`;
		pp.begX = pp.x;
		pp.begY = pp.y;
	}
	p.el.style.cursor = "grabbing";

	const move = e => {
		const [ex, ey] = this.tr(e.clientX, e.clientY);
		const dx = ex - begX;
		const dy = ey - begY;
		for (const p of grp) {
			p.el.style.left = px(p.begX + dx);
			p.el.style.top  = px(p.begY + dy);
		}
		if (!moved && Math.abs(dx) + Math.abs(dy) <= CLICK_LIMIT)
			return;

		moved = true;
		this.rotatingPiece = null;
		const [cx, cy] = [begCx + dx, begCy + dy];
		const slot = this.findSlotAt(cx, cy);
		if (!slot) return this.failRoot();
		if (slot.piece === p) return this.failSelf();
		if (slot === curSlot) return;
		curSlot = slot;
		this.moveGrp(p, slot);
	};

	const end = e => {
		p.el.releasePointerCapture(e.pointerId);
		p.el.removeEventListener("pointermove", move);
		p.el.removeEventListener("pointerup", end);
		p.el.removeEventListener("pointercancel", end);
		p.el.style.cursor = "grab";
		// grpはsplitされるかもしれないので、コピーをcurGrpとする。
		this.curGrp = new Set(grp);
		this.raisePieces(grp);
		if (!moved) {
			this.rotatePiece(p, e.button === 2 ? 1 : -1);
			this.chkFail();
			return;
		}
		this.chkFail();
		const [ex, ey] = this.tr(e.clientX, e.clientY);
		const slot = this.findSlotAt(ex, ey);
		// ドラッグ中のピースがどいた後マウスを動かすと
		// mouseenterが発生する。そのタイミングでピースをフラッ
		// シュするのは、ピース境界をまたいだわけではないので
		// 不自然。すでにフラッシュ済み扱いにして回避。
		this.flashedGrp = slot?.piece?.grp;
		for (const pp of grp)
			this.animatePiece(pp);
	};

	hook(p.el, "pointermove", move);
	hook(p.el, "pointerup", end);
	hook(p.el, "pointercancel", end);
}
lowerPieces() {
	for (const p of this.raisedPieces)
		p.el.style.zIndex = PIECE_Z;
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
rotatePiece(p, dir) {
	if (p.grp.size > 1) {
		if (this.moveGrp(p, p.slot, dir))
			return;
		this.splitGrp(p);
	}
	this.rotatingPiece = p;
	p.rot += dir;
	p.rotated = true;
	this.animatePiece(p);
}
moveGrp(p, slot, rotDir=0) {
	for (const pp of p.grp)
		pp.visited = false;
	const backwards = new Map();
	const victims = [];
	if (!this.moveDFS(p, slot, p.grp, backwards, victims, rotDir))
		return false;
	this.failFor = null;
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
			pp.rot += rotDir;
			pp.rotated = true;
			this.animatePiece(pp);
		}
	}
	return true;
}
moveDFS(p, slot, grp, backwards, victims, rotDir) {
	if (!slot) return this.failRoot();
	if (p.visited) return true;
	p.visited = true;
	const pp = slot.piece;
	if (!pp.alive) return this.failRoot();
	backwards.set(slot, p.slot);
	if (grp !== pp.grp) {
		if (pp.grp.size > 1) return this.failGrp(pp.grp);
		victims.push(pp)
	}
	for (let dir = 0; dir < this.N; ++dir) {
		const np = adjPiece(p, dir);
		if (grp !== np?.grp) continue;
		const ns = slot.nbors[mod(dir + rotDir, this.N)];
		if (!this.moveDFS(np, ns, grp, backwards, victims, rotDir))
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
	if (p.rotated && !this.isOk(p))
		return;
	const dir = Math.random() < 0.5 ? -1 : 1;
	p.rot += dir;
	if (this.isOk(p))
		p.rot -= dir * 2;
	p.rotated = false;
}
swapPieces(a, b) {
	const a_slot = a.slot;
	this.setPieceSlot(a, b.slot);
	this.setPieceSlot(b, a_slot);
	if (!b.rotated || this.isOk(b)) {
		const dir = Math.random() < 0.5 ? -1 : 1;
		b.rot += dir;
		if (this.isOk(b))
			b.rot -= dir * 2;
		b.rotated = false;
	}
	this.raisePieces([b]);
	this.animatePiece(b);
}
isAlive(p) {
	return p.alive;
}
chkOk(p) {
	if (!this.isOk(p)) {
		this.chkJoin(p);
		return;
	}
	if (!this.isAlive(p)) return;
	flashNode(p.el, this.root);
	this.addHist(p);
	this.clearPiece(p);
	if (this.alives.length === 0)
		flashNode(this.root, this.root,
			  { t: ROOT_FLASH_T, cb: ()=>this.closeUI() });
}
chkJoin(p) {
	// どかされたピースのtransitionendで来た場合は連結判定をしない。
	// この場合grpの比較に===は使えない。curGrpの設定後に回転での
	// splitが起き得るので。
	if (!this.curGrp.has(p)) return;
	const nps = this.findOkNbors(p);
	if (nps.length === 0) return;
	// join後のgrpは新Setにする。undo可否のチェック時、grpの内容が
	// 不変であることを仮定している。
	const grp = new Set(p.grp);
	const ogrps = new Set([p.grp]);
	for (const np of nps)
		ogrps.add(np.grp);
	for (const np of nps) {
		for (const nnp of np.grp)
			grp.add(nnp);
	}
	this.setGrp(grp);
	this.addHist([grp, ...ogrps]);
	this.joinFlash(grp);
}
splitGrp(p) {
	const grp = p.grp;
	grp.delete(p);
	this.setGrp(new Set([p]));
	for (const pp of grp)
		pp.visited = false;
	const newGrps = [];
	for (let dir = 0; dir < this.N; ++dir) {
		// split後のgrpは新Setにする。undo可否のチェック時、
		// grpの内容が不変であることを仮定している。
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
	for (let dir = 0; dir < this.N; ++dir)
		this.splitDFS(adjPiece(p, dir), grp, newGrp);
}
warnRoot() {
	const cs = getCS(this.root);
	const el = mkdiv(0, 0, cs.width, cs.height, {
		backgroundColor: WARN_COL,
		zIndex: ROOT_WARN_Z,
		opacity: WARN_OPACITY,
	});
	this.root.appendChild(el);
	kickFlash(el, WARN_T);
	return false;
}
failRoot() {
	this.failFor = "root";
	return false;
}
failSelf() {
	this.failFor = null;
	return false;
}
chkFail() {
	if (this.failFor === "root")
		this.warnRoot();
}
failGrp(grp) {
	// 連結ピースに重なったときはすぐにハイライトする。
	this.failFor = "grp"; // 現状は"root"をキャンセルする意味のみ。
	this.flashWall(grp, WARN_COL);
	for (const p of grp)
		flashNode(p.el, this.root,
			  { col: WARN_COL,
			    t: WARN_T,
			    begOpacity: WARN_OPACITY });
	return false;
}
joinFlash(grp) {
	this.flashWall(grp, JOIN_COL);
	for (const p of grp)
		flashNode(p.el, this.root,
			  { col: JOIN_FLASH_COL, t: JOIN_FLASH_T });
}
flashWall(grp, col, t=WALL_FLASH_T) {
	for (const p of grp)
		this.flashWall1(p, col, t);
}
flashWall1(p, col, t, allWall) {
	const s = p.el.style;
	const div = mkdiv(s.left, s.top, s.width, s.height, {
		pointerEvents: "none",
		zIndex: WALL_FLASH_Z,
	});
	for (let dir = 0; dir < this.N; ++dir) {
		if (allWall || needWall(p, dir))
			this.addWall(div, dir, col, WALL_FLASH_MULT);
	}
	this.root.appendChild(div);
	kickFlash(div, t);
}
findOkNbors(p) {
	const N = this.N;
	const ans = [];
	for (let i = 0; i < N; ++i) {
		const np = adjPiece(p, i);
		if (!np?.alive) continue;
		if (p.grp === np.grp) continue;
		const cp = p.okNbors[mod(i - p.rot, N)];
		if (np === cp && mod(np.rot, N) === mod(p.rot, N))
			ans.push(np);
	}
	return ans;
}
addHist(p) {
	this.hist.push(p);
	this.undoBtn.disabled = false;
}
undo() {
	while (this.hist.length && !this.tryUndo())
		;
	this.undoBtn.disabled = this.hist.length === 0;
}
tryUndo() {
	const pOrGrps = this.hist.pop();
	if (pOrGrps instanceof Array)
		return this.undoJoin(pOrGrps);
	this.undoPiece(pOrGrps);
	return true;
}
undoPiece(p) {
	// 回転連打で正解位置を通り過ぎてしまうのを防ぐため、最後に回
	// 転したピースが正解位置にあると、それ以上動かせない。それを
	// キャンセル。
	this.rotatingPiece = null;
	this.drawPiece(p);
	p.alive = true;
	this.alives.push(p);
	p.rot = 0;
	p.rotated = false;
	this.drawWall(p);
	flashNode(p.el, this.root);
}
undoJoin(grps) {
	const join = grps.shift();
	if (!isGrpAlive(join)) return false;
	for (const g of grps)
		this.setGrp(g);
	for (const g of grps)
		this.joinFlash(g);
	return true;
}
clearPiece(p) {
	this.ungroup(p);
	p.el.remove();
	p.cover.remove();
	p.alive = false;
	this.alives = this.alives.filter(pp => pp !== p);
}
ungroup(p) {
	for (const pp of p.grp)
		this.setGrp(new Set([pp]));
}
tr(x, y) {
	const r = getBBox(this.root);
	const [rx, ry] = [x - r.left, y - r.top];
/* cut-from */
	if (this.orient) {
		const ir = getBBox(this.img);
		return [ry, ir.width - rx];
	}
/* cut-to */
	return [rx, ry];
}
trRect(r) {
/* cut-from */
	if (mod(this.orient, 2) === 1) {
		const [x, y] = this.tr(r.right, r.top);
		return new DOMRect(x, y, r.height, r.width);
	}
/* cut-to */
	return new DOMRect(...this.tr(r.left, r.top), r.width, r.height);
}
visibles(node) {
	const r = this.trRect(getBBox(node));
	const pieces = this.slots.map(s => s.piece);
	return pieces.filter(p => {
		return p.cx < r.left || r.right  < p.cx
			|| p.cy < r.top  || r.bottom < p.cy;
	});
}
jumpPiece(p) {
	this.animatePiece(p, true);
}
animatePiece(p, jump) {
	const t = MOVE_T;
	p.el.style.transition = jump ? "none"
		: `transform ${t}s ease, left ${t}s ease, top ${t}s ease`;
	const deg = p.rot * 360 / this.N;
	p.el.style.transform = `rotate(${deg}deg)`;
	p.el.style.left = px(p.x);
	p.el.style.top  = px(p.y);
}
isOk(p) {
	return p.slot === p.okSlot &&
		mod(p.rot, this.N) === 0;
}
mkUIPanel() {
	const panel = mkdiv(null, 0, null, null, {
		right: 0,
		display: "flex",
		flexDirection: "row",
		pointerEvents: "none", // ボタン間のピースを操作できるよう。
		zIndex: BIG_Z,
		opacity: BTN_OPACITY,
	});
	panel.className = "rotpuzzle-ui";
	this.root.appendChild(panel);
	const btn = (text, handler, spc) => mkBtn(panel, text, handler, spc);
	const [shape, btnText] = this.lo.getOtherPuzzle();

	this.undoBtn = btn("↶", () => this.undo());
	const wallBtn = btn("◌", null, "1.5em");
/* cut-from */
	// \u{1F504}: ANTICLOCKWISE DOWNWARDS AND
	//            UPWARDS OPEN CIRCLE ARROWS
	btn("\u{1F504}", e => this.chgOrient(e));
/* cut-to */
	this.hintBtn = btn("?", null,  "1.5em");
	const decBtn = btn("-", () => this.chgDivision(-1));
	const incBtn = btn("+", () => this.chgDivision(1));
	btn(btnText, () => this.chgShape(shape));
	btn("X", () => this.closeUI());

	longPress(this.hintBtn, () => this.hint(), () => this.flashVer());
	longPress(wallBtn, () => this.toggleWall(), () => this.askWall());
	decBtn.disabled = this.division <= 1;
	incBtn.disabled = this.division >= this.maxDivision;
	this.undoBtn.disabled = true;
	return panel;
}
toggleWall() {
	this.hasWall = !this.hasWall;
/* cut-from */
	setUrlParam("hasWall", this.hasWall ? 1 : 0);
/* cut-to */
	this.drawWallAll();
}
askWall() {
	const w = Number(prompt("Border width?")); // NaN when invalid
	if (w > 0) this.wallW = w;
/* cut-from */
	setUrlParam("wallW", this.wallW);
/* cut-to */
	this.drawWallAll();
}
drawWallAll() {
	for (const p of this.alives)
		this.drawWall(p);
}
hint() {
	if (this.hintBtn.textContent === "?") {
		this.showAnswer();
		// \u{1F500}: TWISTED RIGHTWARDS ARROWS
		this.hintBtn.textContent = "\u{1F500}";
	} else {
		this.shuffle();
		this.hintBtn.textContent = "?";
	}
	this.flashPcs();
}
chgShape(shape) {
	this.closeUI();
	const cfg = newCfg({
		division: this.division,
		hasWall: this.hasWall,
		shape });
	runPuzzle(this.img, cfg, this.frame);
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
/* cut-from */
chgOrient(e) {
	e.stopPropagation();
	this.orient = 1- this.orient;
	this.redraw();
	setUrlParam("orient", this.orient);
	centerNode(this.root);
}
/* cut-to */
flashPcs() {
	const pcs = this.alives.length;
	this.flashText(`${pcs} pcs`);
}
flashVer() {
	this.flashText("ver: " + VERSION);
}
flashText(text, t=PCS_T) {
	const vr = this.lo.viewBox();
	const [w, h] = [vr.width * 2/3, vr.height * 2/3];
	const div = mkText(text, w, h, "white");
	div.style.zIndex = MAX_Z;
	div.style.pointerEvents = "none";
	this.root.appendChild(div);
	kickFlash(div, t);
}
enableResize() {
	this.resizeFun = e => this.onResize(e);
	this.resizeTimer = null;
	hook(window, "resize", this.resizeFun);
}
onResize(e) {
	clearTimeout(this.resizeTimer);
	this.resizeTimer = setTimeout(() => {
		this.redraw();
        }, 200);
}
disableResize() {
	window.removeEventListener("resize", this.resizeFun);
	clearTimeout(this.resizeTimer);
	this.resizeTimer = null;
}
closeUI() {
	this.disableResize();
	this.root.remove();
/* cut-from */
	clearDbg();
/* cut-to */
}
}
const newLayout = n => {
	if (n === 4) return new Square();
	if (n === 6) return new Hex();
	return null;
};
class Layout {
layout(img, division, frame, orient) {
/* cut-from */
	if (frame)
		fitFrame(frame, orient);
/* cut-to */
	const geom = imgGeom(img);
	if (!img.classList.contains("rotpuzzle-target"))
		geom.viewBox = clip(scrBox(), geom.viewBox);

	let vr = geom.viewBox;
	this.imgBox = geom.imgBox;
/* cut-from */
	if (orient) {
		vr = new DOMRect(0, 0, vr.height, vr.width);
		this.imgBox = vr;
	}
/* cut-to */
	this.vBox = vr;
	if (vr.width <= 0 || vr.height <= 0) throw "image too small";

	const m = this.minMargin();
	const [maxW, maxH] = [vr.width  - m * 2, vr.height - m * 2];
	if (division) {
		this.layoutShape(maxW, maxH, division);
		if (this.sz < 10) throw "image too small";
	} else {
		this.resize(maxW, maxH);
	}
	this.areaX = (vr.width  - this.areaW) / 2;
	this.areaY = (vr.height - this.areaH) / 2;
	this.imgOffset = [this.imgBox.left - vr.left,
			  this.imgBox.top  - vr.top];
}
imgPos(x, y) {
	const [ix, iy] = this.imgOffset;
	return [ix - x, iy - y, this.imgBox.width, this.imgBox.height];
}
setPiecePos(p, pos) {
	const [col, row] = pos;
	const x = this.areaX + col * this.sz;
	const y  = this.areaY + row * this.vStep;
	p.x  = x - OVLAP_PX;
	p.y  = y - OVLAP_PX * this.vRatio;
	p.cx = x + this.sz / 2;
	p.cy = y + this.sz * this.vRatio / 2;
}
wallPts(vertex, hasL, hasR, wallW) {
	const sz = this.sz + OVLAP_PX * 2;
	const w = sz / 2;
	const h = sz * this.vRatio / 2;
	const bw = wallW;
	const bh = wallW * this.vRatio;
	const pts = this.shapePts();
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
setAdj(slots) {
	const pos2slot = new Map;
	for (const slot of slots)
		pos2slot.set(JSON.stringify(slot.pos), slot);
	for (const slot of slots) {
		const p = slot.piece;
		const [col, row] = slot.pos;
		for (let dir = 0; dir < this.N; ++dir) {
			const [dcol, drow] = this.dirToDelta(dir);
			const npos = [col + dcol, row + drow];
			const s = pos2slot.get(JSON.stringify(npos));
			slot.nbors[dir] = s?.visible ? s : null;
			p.okNbors[dir] = s?.visible ? s.piece : null;
		}
	}
}
viewBox() { return this.vBox; };
pieceSz() { return this.sz + OVLAP_PX * 2; };
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
resize(w, h) {
	const sz = Math.min(w / this.cols, h / this.rows);
	this.areaW = this.cols * sz;
	this.areaH = this.rows * sz;
	this.sz = sz;
	this.vStep = sz;
}
*genPiecePositions() {
	for (let row = 0; row < this.rows; row++)
		for (let col = 0; col < this.cols; col++)
			yield [col, row];
}
minMargin() {
	const short = Math.min(this.vBox.width, this.vBox.height);
	return short * SQUARE_MARGIN_RATIO;
}
getOtherPuzzle() { return [6, "⬡"]; }
dirToDelta(dir) { return squareDirs[dir]; }
shapePts() { return squarePts; }
wallOffsets() { return squareWallOffsets; }
mkPieceShape(x, y, sz) { return mkdiv(x, y, sz, sz); }
edgeVecCoeff() { return 0.5; }
}
class Hex extends Layout{
constructor() { super(); this.N = 6; }
getOtherPuzzle() { return [4, "□"]; }
dirToDelta(dir) { return hexDirs[dir]; }
shapePts() { return hexPts; }
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
	this.setSz(sz);
}
setSz(sz) {
	const diam = sz * this.vRatio;
	const rep = diam * 3/4;
	this.areaW = sz * (this.cols + 0.5);
	this.areaH = rep * this.rows + diam / 4;
	this.vStep = sz * this.vRatio * 3/4;
	this.sz = sz;
}
resize(w, h) {
	const hSz = w / (this.cols + 0.5);
	const vRep = h / (this.rows + 1/3);
	const vSz = vRep * 4/3 / this.vRatio;
	const sz = Math.min(hSz, vSz);
	this.setSz(sz);
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
	return this.shapePts().map(([x, y]) => {
		return [x * hw + hw, y * hh + hh];
	});
}
}
const mkBtn = (panel, text, handler, spc) => {
	const btn = document.createElement("button");
	btn.textContent = text;
	Object.assign(btn.style, {
		width: "1.5em",
		height: "1.5em",
		marginRight: spc,
		padding: 0,
		font: "bold 1em sans-serif",
		lineHeight: 1,
		pointerEvents: "auto", // 親のpanelがnoneなので。
	});
	btn.style.fontSize = matchMedia("(pointer: coarse)").matches
		 ? TOUCH_FONT_SIZE : FONT_SIZE;
	hook(btn, "click", handler);
	panel.appendChild(btn);
	return btn;
};
const longPress = (btn, shortFun, longFun, t=500) => {
	let timer = null;
	let isLong = false;
	hook(btn, "pointerdown", () => {
		isLong = false;
		timer = setTimeout(() => {
			isLong = true;
			longFun();
		}, t);
	});
	hook(btn, "pointerup", () => {
		clearTimeout(timer);
		timer = null;
		if (!isLong) shortFun();
	});
	hook(btn, "pointercancel", () => {
		clearTimeout(timer);
		timer = null;
	});
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
	if (val.endsWith("%"))
		return avail * parseFloat(val) / 100;
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
		if (getCS(e).backgroundImage !== "none") return e;
	}
	return null;
};
const getXRenderBox = (renderer, iw, ih) => {
	const rr = getBBox(renderer);
	const cs = getCS(renderer);
	if (cs.backgroundSize !== "cover")
		// unsupported
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
		// X carousel support
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
		// Exclude reddit underlay img (opacity 0.3).
		// X carousel img (opacity 0.0) should not be excluded.
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
const hook = (el, ev, cb, opt) => { el.addEventListener(ev, cb, opt); };
const hookTransition = (el, cb) => {
	for (const e of ["transitionend", "transitioncancel"])
		hook(el, e, cb);
};
const ignoreEvs = (el, evs) => {
	for (const ev of evs)
		hook(el, ev, e => {
			if (e.target.closest('.rotpuzzle-ui'))
				return;
			e.preventDefault();
			e.stopPropagation();
		}, { passive: false });
};
const flashNode = (node, parent, { col=FLASH_COL,
				   t=PIECE_FLASH_T,
				   begOpacity=1.0,
				   cb=null }={}) => {
	const x = node === parent ? "0px" : node.style.left;
	const y = node === parent ? "0px" : node.style.top;
	const el = mkdiv(x, y, node.style.width, node.style.height, {
		background: col,
		pointerEvents: "none",
		opacity: begOpacity,
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
	void el.offsetWidth; // force layout
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
const isGrpAlive = g => {
	return [...g].every(p => p.grp === g);
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
const toPath = (pts) => {
	return pts.map(([x, y]) => `${x}px ${y}px`).join(',');
};
/* cut-from */
const centerNode = node => {
    const r = getBBox(node);
    const iCenter = (r.top + r.bottom) / 2;
    const vCenter = window.innerHeight / 2;
    window.scrollBy({ top: iCenter - vCenter, left: 0, behavior: "smooth" });
};
const toPx = val => {
	const div = mkdiv(0, 0, val, val, { visibility: "hidden" });
	document.body.appendChild(div);
	const px = parseFloat(getCS(div).width);
	div.remove();
	return px;
};
const clearDbg = (...args) => {
	if (window.devkit)
		return window.devkit.clearDbg(...args);
};
const msg = (...args) => {
	if (window.devkit)
		return window.devkit.msg(...args);
	else
		console.log(...args);
};
// autofitはimgのmaxWidth、maxHeightを元にサイズを計算する。回転ありの
// 場合、imgにセットするwidth, heightは回転前のものなので、maxWidth、
// maxHeightを越えてしまうかもしれない。そのため、maxWidth、maxHeight
// は回転時に消してしまう。frameInfoは起動時に一度だけ取得して、それを
// 使い回す。
const frameInfo = (img) => {
	const el = img.parentElement;
	if (!el.classList.contains("rotpuzzle-autofit"))
		return null;
	return { el, img,
		 maxW: img.style.maxWidth,
		 maxH: img.style.maxHeight };
};
const maxSizeBeforeRot = (frame, orient) => {
	return orient ? [toPx(frame.maxH), toPx(frame.maxW)]
		      : [toPx(frame.maxW), toPx(frame.maxH)];
};
const fitFrame = (frame, orient) => {
	const img = frame.img;
	const wideness = img.naturalWidth / img.naturalHeight;
	const [maxW, maxH] = maxSizeBeforeRot(frame, orient);
	let ih = maxH;
	let iw = maxH * wideness;
	if (iw > maxW) {
		iw = maxW;
		ih = maxW / wideness;
	}
	for (const el of [img, frame.el])
		Object.assign(el.style, {
			maxWidth: null,
			maxHeight: null,
			width: px(iw),
			height: px(ih),
			margin: null,
			transform: null });
	if (orient) {
		const exH = ih - iw;
		const margin = exH > 0 ? [0, exH / 2] : [-exH / 2, 0];
		frame.el.style.margin = px(...margin);
		frame.el.style.transform = "rotate(90deg)";
	}
};
const waitForImage = (img) => {
	if (img.complete) {
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		hook(img, "load", resolve, { once: true });
		hook(img, "error", reject, { once: true });
	});
};
const runOnImgs = async (imgs) => {
	await Promise.all([...imgs].map(waitForImage));
	for (const img of imgs) {
		const frame = frameInfo(img);
		runPuzzle(img, newCfg(), frame);
	}
};
const setUrlParam = (name, val) => {
	if (this.isBookmarklet) return;
	const url = new URL(location.href);
	url.searchParams.set(name, val);
	history.replaceState(null, "", url);
};
const isHttpUrl = value => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};
const chkParams = () => {
	const params = new URLSearchParams(location.search);
	const src = params.get("src");
	if (!src || !isHttpUrl(src)) return;
	const img = document.querySelector(".rotpuzzle-target");
	if (!img) return;
	img.src = "";
	img.complete = false;
	img.src = src;
	const page = params.get("page");
	if (!page || !isHttpUrl(page)) return;
	const link = document.querySelector("#page");
	link.href = page;
	link.target = "_blank";
	link.rel = "noopener noreferrer";
	link.textContent = "(Source page)";
};
const setCfgInt = (cfg, params, name) => {
	const s = params.get(name);
	if (!s) return;
	const n = Number(s);
	if (!Number.isInteger(n)) return;
	cfg[name] = n;
};
/* cut-to */
const newCfg = (ovwriteCfg={}) => {
	const cfg = { shape: DFLT_SHAPE,
		      division: DFLT_DIVISION,
		      hasWall: DFLT_HAS_WALL,
		      wallW: DFLT_WALL_W,
/* cut-from */
		      orient: 0,
/* cut-to */
		      shuff: true };
/* cut-from */
	const params = new URLSearchParams(location.search);
	setCfgInt(cfg, params, "shape");
	setCfgInt(cfg, params, "division");
	setCfgInt(cfg, params, "hasWall");
	setCfgInt(cfg, params, "wallW");
	setCfgInt(cfg, params, "shuff");
	setCfgInt(cfg, params, "orient");
/* cut-to */
	Object.assign(cfg, ovwriteCfg);
	return cfg;
};
const runPuzzle = (img, cfg, frame) => {
	const puzzle = new Puzzle(img, cfg, frame);
	try {
		puzzle.startUI();
	} catch (e) {
		if (typeof e !== "string") throw e;
		alert(e);
	}
};
const init = () => {
	clearOld();
/* cut-from */
	chkParams();
	const imgs = document.querySelectorAll(".rotpuzzle-target");
	if (imgs.length) {
		runOnImgs(imgs);
		return;
	}
/* cut-to */
	runPuzzle(findLargestImg(), newCfg());
};
init();
})()

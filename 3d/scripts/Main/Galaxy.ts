enum ZoneStatus {
    None,
    Valid,
    Invalid
}

class IJK {
    
    constructor(
        public i: number,
        public j: number,
        public k: number
    ) {

    }

    public isEqual(other: IJK): boolean {
        return this.i === other.i && this.j === other.j && this.k === other.k;
    }

    public isTile(): boolean {
        let odds = 0;
        if (this.i % 2 === 1) {
            odds++;
        }
        if (this.j % 2 === 1) {
            odds++;
        }
        if (this.k % 2 === 1) {
            odds++;
        }
        return odds === 2;
    }

    public forEachAround(callback: (ijk: IJK) => void): void {
        callback(new IJK(this.i - 1, this.j, this.k));
        callback(new IJK(this.i, this.j - 1, this.k));
        callback(new IJK(this.i, this.j, this.k - 1));
        callback(new IJK(this.i + 1, this.j, this.k));
        callback(new IJK(this.i, this.j + 1, this.k));
        callback(new IJK(this.i, this.j, this.k + 1));
    }
}

class Galaxy extends BABYLON.TransformNode {

	public templateTile: BABYLON.AbstractMesh;
	public templatePole: BABYLON.AbstractMesh;
	public templatePoleEdge: BABYLON.AbstractMesh;
	public templatePoleCorner: BABYLON.AbstractMesh;
	public templateLightning: BABYLON.AbstractMesh;

    public width: number = 10;
    public height: number = 6;
    public depth: number = 8;

    public items: GalaxyItem[][][];
    public tiles: Tile[];
    public zones: Tile[][];

    public editionMode: boolean = false;
    private _pointerDownX: number = NaN;
    private _pointerDownY: number = NaN;

    constructor() {
        super("galaxy");
    }

    public isIJKValid(ijk: IJK): boolean {
        if (ijk.i === 0 || ijk.i === this.width || ijk.j === 0 || ijk.j === this.height || ijk.k === 0 || ijk.k === this.depth) {
            if (ijk.i >= 0 && ijk.i <= this.width && ijk.j >= 0 && ijk.j <= this.height && ijk.k >= 0 && ijk.k <= this.depth) {
                return true;
            }
        }
        return false;
    }

    public async initialize(): Promise<void> {
		this.templateTile = await Main.loadMeshes("tile-lp");
		this.templatePole = await Main.loadMeshes("pole");
		this.templatePoleEdge = await Main.loadMeshes("pole");
		this.templatePoleCorner = await Main.loadMeshes("pole");
		this.templateLightning = await Main.loadMeshes("lightning");
    }

    public async loadLevel(fileName: string): Promise<void> {
        return new Promise<void>(resolve => {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', "assets/levels/" + fileName);
            xhr.onload = () => {
                let data = JSON.parse(xhr.responseText);
                this.width = data.width;
                this.height = data.height;
                this.depth = data.depth;
                this.instantiate();
                for (let i = 0; i < data.orbTiles.length; i++) {
                    let orbTile = data.orbTiles[i];
                    let tile = this.getItem(orbTile.i, orbTile.j, orbTile.k);
                    if (tile && tile instanceof Tile) {
                        tile.hasOrb = true;
                        tile.refresh();
                    }
                }
                resolve();
            }
            xhr.send();
        });
    }

    public clear(): void {
        while (this.getChildren().length > 0) {
            let child = this.getChildren()[0];
            child.dispose();
        }
        this.items = [];
        this.tiles = [];
    }

    public instantiate() {
        this.rotation.y = 0;
        this.clear();
        for (let i = 0; i <= this.width; i++) {
            this.items[i] = [];
            for (let j = 0; j <= this.height; j++) {
                this.items[i][j] = [];
                for (let k = 0; k <= this.depth; k++) {
                    let item = GalaxyItem.Create(i, j, k, this);
                    if (item) {
                        this.items[i][j][k] = item;
                        if (item instanceof Tile) {
                            this.tiles.push(item);
                        }
                        item.instantiate();
                    }
                }
            }
        }

        for (let i = 0; i <= this.width; i++) {
            for (let j = 0; j <= this.height; j++) {
                for (let k = 0; k <= this.depth; k++) {
                    let item = this.getItem(i, j, k);
                    if (item && item instanceof Tile) {
                        item.updateNeighbours();
                        if (item.neighbours.length != 4) {
                            console.log("Potentiel error with neighbour detection. " + item.neighbours.length + " detected. Expected 4.");
                            console.log("Check " + i + " " + j + " " + k);
                        }
                    }
                }
            }
        }

        Main.Scene.onPointerObservable.removeCallback(this.pointerObservable);
        Main.Scene.onPointerObservable.add(this.pointerObservable);

        if (this.editionMode) {
            document.getElementById("editor-part").style.display = "block";
            document.getElementById("width-value").textContent = this.width.toFixed(0);
            document.getElementById("btn-width-dec").onclick = () => {
                this.width = Math.max(2, this.width - 2);
                this.instantiate();
            }
            document.getElementById("btn-width-inc").onclick = () => {
                this.width = this.width + 2;
                this.instantiate();
            }
            document.getElementById("height-value").textContent = this.height.toFixed(0);
            document.getElementById("btn-height-dec").onclick = () => {
                this.height = Math.max(2, this.height - 2);
                this.instantiate();
            }
            document.getElementById("btn-height-inc").onclick = () => {
                this.height = this.height + 2;
                this.instantiate();
            }
            document.getElementById("depth-value").textContent = this.depth.toFixed(0);
            document.getElementById("btn-depth-dec").onclick = () => {
                this.depth = Math.max(2, this.depth - 2);
                this.instantiate();
            }
            document.getElementById("btn-depth-inc").onclick = () => {
                this.depth = this.depth + 2;
                this.instantiate();
            }
            document.getElementById("btn-download").onclick = () => {
                let data = this.serialize();
                
                var tmpLink = document.createElement( 'a' );
                let name = "galaxy-editor";
                tmpLink.download = name + ".json";
                tmpLink.href = 'data:json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data));  
                
                document.body.appendChild( tmpLink );
                tmpLink.click(); 
                document.body.removeChild( tmpLink );
            }
        }
        else {
            document.getElementById("editor-part").style.display = "none";
        }
        this.updateZones();
    }

    public updateZones(): void {
        this.zones = [];
        let tiles = [...this.tiles];
        while (tiles.length > 0) {
            let tile = tiles.pop();
            let zone = [];
            this.addToZone(zone, tile, tiles);
            this.zones.push(zone);
        }

        let solved = true;
        for (let i = 0; i < this.zones.length; i++) {
            let zone = this.zones[i];
            let zoneStatus = this.isZoneValid(zone);
            if (zoneStatus != ZoneStatus.Valid) {
                solved = false;
            }
            zone.forEach(t => {
                t.setIsValid(zoneStatus);
            })
        }

        if (solved) {
            document.getElementById("solve-status").textContent = "SOLVED";
            document.getElementById("solve-status").style.color = "green";
        }
        else {
            document.getElementById("solve-status").textContent = "NOT SOLVED";
            document.getElementById("solve-status").style.color = "red";
        }
    }

    public areSymetrical(tileA: Tile, edgeA: IJK, tileB: Tile, edgeB: IJK, tilesToConsider: Tile[]): boolean {
        let footPrintA = tileA.getFootPrint(edgeA);
        let footPrintB = tileB.getFootPrint(edgeB);
        if (footPrintA != footPrintB) {
            return false;
        }
        let footPrint = footPrintA;
        let output = true;
        for (let i = 0; i < 3; i++) {
            if (footPrint[i] === "1") {
                let tileANext = tileA.getNeighbour(edgeA, i + 1);
                let tileBNext = tileB.getNeighbour(edgeB, i + 1);
                if (!tileANext || !tileBNext) {
                    debugger;
                }
                let tileANextIndex = tilesToConsider.indexOf(tileANext);
                let tileBNextIndex = tilesToConsider.indexOf(tileBNext);
                if (tileANextIndex != -1 && tileBNextIndex != -1) {
                    tilesToConsider.splice(tileANextIndex, 1);
                    tilesToConsider.splice(tileBNextIndex, 1);
                    output = output && this.areSymetrical(tileANext, tileA.getNextEdge(edgeA, i + 1), tileBNext, tileB.getNextEdge(edgeB, i + 1), tilesToConsider);
                }
            }
        }
        return output;
    }

    public isZoneValid(zone: Tile[]): ZoneStatus {
        let orbTile: Tile;
        for (let i = 0; i < zone.length; i++) {
            let tile = zone[i];
            if (tile.hasOrb) {
                if (!orbTile) {
                    orbTile = tile;
                }
                else {
                    return ZoneStatus.None;
                }
            }
        }
        if (orbTile) {
            let e0 = orbTile.edges[0];
            let border0 = this.getItem(e0);
            let e2 = orbTile.edges[2];
            let border2 = this.getItem(e2);
            let e1 = orbTile.edges[1];
            let border1 = this.getItem(e1);
            let e3 = orbTile.edges[3];
            let border3 = this.getItem(e3);

            let tilesToConsider = [...zone];
            let orbTileIndex = tilesToConsider.indexOf(orbTile);
            tilesToConsider.splice(orbTileIndex, 1);

            if (border0 && border2 || !border0 && !border2) {
                if (border1 && border3 || !border1 && !border3) {
                    let output = true;
                    if (!border0) {
                        let tileA = orbTile.neighbours[0];
                        let tileAIndex = tilesToConsider.indexOf(tileA);
                        tilesToConsider.splice(tileAIndex, 1);
                        let tileB = orbTile.neighbours[2];
                        let tileBIndex = tilesToConsider.indexOf(tileB);
                        tilesToConsider.splice(tileBIndex, 1);
                        output = output && this.areSymetrical(tileA, e0, tileB, e2, tilesToConsider);
                    }
                    if (output && !border1 && tilesToConsider.length > 0) {
                        let tileC = orbTile.neighbours[1];
                        let tileCIndex = tilesToConsider.indexOf(tileC);
                        tilesToConsider.splice(tileCIndex, 1);
                        let tileD = orbTile.neighbours[3];
                        let tileDIndex = tilesToConsider.indexOf(tileD);
                        tilesToConsider.splice(tileDIndex, 1);
                        output = this.areSymetrical(tileC, e1, tileD, e3, tilesToConsider);
                    }
                    if (output) {
                        return ZoneStatus.Valid;
                    }
                    else {
                        return ZoneStatus.Invalid;
                    }
                }
            }
            return ZoneStatus.Invalid;
        }
        return ZoneStatus.None;
    }

    private addToZone(zone: Tile[], tile: Tile, tiles: Tile[]): void {
        if (zone.indexOf(tile) === -1) {
            zone.push(tile);
        }
        for (let i = 0; i < tile.neighbours.length; i++) {
            let edge = tile.edges[i];
            if (!this.getItem(edge)) {
                let other = tile.neighbours[i];
                let index = tiles.indexOf(other);
                if (index != -1) {
                    tiles.splice(index, 1);
                    this.addToZone(zone, other, tiles);
                }
            }
        }
    }

    public getItem(ijk: IJK): GalaxyItem;
    public getItem(i: number, j: number, k: number): GalaxyItem;
    public getItem(a: IJK | number, j?: number, k?: number) : GalaxyItem {
        let i: number;
        if (a instanceof IJK) {
            i = a.i;
            j = a.j;
            k = a.k;
        }
        else {
            i = a;
        }
        if (this.items[i]) {
            if (this.items[i][j]) {
                return this.items[i][j][k];
            }
        }
    }

    public setItem(ijk: IJK, item: GalaxyItem): void {
        this.items[ijk.i][ijk.j][ijk.k] = item;
    }

    public toggleBorder(ijk: IJK): void {
        let item = this.getItem(ijk);
        if (item) {
            item.dispose();
            this.setItem(ijk, undefined);
        }
        else {
            let border = new Border(ijk.i, ijk.j, ijk.k, this);
            border.instantiate();
            this.setItem(ijk, border);
        }
    }

    public worldPositionToIJK(worldPosition: BABYLON.Vector3): IJK {
        let i = Math.round(worldPosition.x + this.width * 0.5);
        let j = Math.round(worldPosition.y + this.height * 0.5);
        let k = Math.round(worldPosition.z + this.depth * 0.5);
        
        return new IJK(i, j, k);
    }

    public pointerObservable = (eventData: BABYLON.PointerInfo) => {
        if (eventData.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            this._pointerDownX = eventData.event.clientX;
            this._pointerDownY = eventData.event.clientY;
        }
        if (eventData.type === BABYLON.PointerEventTypes.POINTERUP) {
            let delta = Math.abs(this._pointerDownX - eventData.event.clientX) + Math.abs(this._pointerDownY - eventData.event.clientY);
            if (delta < 10) {
                this.onPointerUp();
            }
        }
    }

    public onPointerUp() {
        let pick = Main.Scene.pick(
            Main.Scene.pointerX,
            Main.Scene.pointerY
        );
        if (pick && pick.hit) {
            let ijk = this.worldPositionToIJK(pick.pickedPoint);
            
            let odds = 0;
            if (ijk.i % 2 === 1) {
                odds++;
            }
            if (ijk.j % 2 === 1) {
                odds++;
            }
            if (ijk.k % 2 === 1) {
                odds++;
            }

            if (odds === 1) {
                this.toggleBorder(ijk);
                this.updateZones();
            }
            if (odds === 2 && this.editionMode) {
                let item = this.getItem(ijk);
                if (item instanceof Tile) {
                    item.hasOrb = !item.hasOrb;
                    item.refresh();
                    this.updateZones();
                }
            }
        }
    }

    public serialize(): any {
        let data: any = {};
        data.width = this.width;
        data.height = this.height;
        data.depth = this.depth;
        data.orbTiles = [];
        this.tiles.forEach(t => {
            if (t.hasOrb) {
                data.orbTiles.push(
                    {
                        i: t.i,
                        j: t.j,
                        k: t.k
                    }
                )
            }
        });
        return data;
    }
}
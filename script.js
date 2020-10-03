_fileCache = {}
async function getFile(url) {
    if (url in _fileCache)
        return _fileCache[url];

    const resp = await fetch(url);
    if (resp.status !== 200)
        throw("Could not find shader " + url);

    let fileContents = "";
    const reader = resp.body.getReader();
    done = false;
    while (!done) {
        let fileBody = await reader.read();
        if (!fileBody.value) {
            done = true;
        } else {
            fileContents += String.fromCharCode.apply(null, fileBody.value);
        }
    }
    _fileCache[url] = fileContents;
    return fileContents;
}

class DrawParams {
    constructor(ctx, cell_height, cell_width) {
        this.ctx         = ctx;
        this.cell_height = cell_height;
        this.cell_width  = cell_width;
    }
}

class InteractiveObjects {
    // This represents interactive elements in the environment - checkpoints,
    // buttons, keys
}

class MovingPlatform {
    isMovingTowardsEnd = true;

    constructor(start_coords, end_coords, curr_coords) {
        this.start_coords = start_coords;
        this.end_coords =  end_coords;
        this.curr_coords =  curr_coords;
    }
}

CELLTYPES = {
    AIR: ' ',
    WATER: '~',
    GROUND: '=',
    BUTTON: '*',
    ONGROUND: '%',
    OFFGROUND: '@',
    HConnector: '-',
    HBoundry: '/',
    VConnector: '|',
    VBoundry: '_',
    CHECKPOINT: '^',
    isKey: (c) => Boolean(c.match("[a-z]")),
    isLock: (c) => Boolean(c.match("[A-Z]")),
    isPortal: (c) => Boolean(c.match("[0-9]")),
}

class Level {
    constructor(id) {
        this.id = id;
        this._dimensions = null;
        this.raw_data = null;
        this.initialized = false;
        this.lines = null;
        this.moving_platforms = [];
    }

    async initialize() {
        this.raw_data = await getFile(`./${this.id}.level`);
        this.lines = this.raw_data.split('\n');
        this.initialized = true;

        for (let y = 0; y < this.dimensions[1]; y++) {
            for (let x = 0; x < this.dimensions[0]; x++) {
                this.extract_moving_platform(x, y);
            }
        }

        // TODO find all InteractiveObjects
    }

    extract_moving_platform(x, y) {
        if (this.get_cell(x, y) != CELLTYPES.GROUND)
            return;

        function replace(line, x) {
            return line.substr(0, x) + ' ' + line.substr(x+1);
        }

        if (this.get_cell(x - 1, y) == CELLTYPES.HConnector ||
            this.get_cell(x + 1, y) == CELLTYPES.HConnector) {
            this.lines[y] = replace(this.lines[y], x);

            const left_boundry = [x - 1, y];
            while (this.get_cell(...left_boundry) != CELLTYPES.HBoundry)
                left_boundry[0]--;
            const right_boundry = [x + 1, y];
            while (this.get_cell(...right_boundry) != CELLTYPES.HBoundry)
                right_boundry[0]++;

            this.moving_platforms.push(new MovingPlatform(left_boundry, right_boundry, [x, y]));
        } else if (this.get_cell(x, y - 1) == CELLTYPES.VConnector ||
            this.get_cell(x, y + 1) == CELLTYPES.VConnector) {
            this.lines[y] = replace(this.lines[y], x);

            const top_boundry = [x, y - 1];
            while (this.get_cell(...top_boundry) != CELLTYPES.VBoundry)
                top_boundry[1]--;
            const bottom_boundry = [x, y + 1];
            while (this.get_cell(...bottom_boundry) != CELLTYPES.VBoundry)
                bottom_boundry[1]++;

            this.moving_platforms.push(new MovingPlatform(top_boundry, bottom_boundry, [x, y]));
        }
    }

    get dimensions() {
        if (this._dimensions)
            return this._dimensions;

        let height = this.lines.length - 1;
        let width = this.lines.map(x => x.length).reduce((x, y) => Math.max(x, y));
        this._dimensions = [width, height];

        return this._dimensions;
    }

    get_cell(x, y) {
        if (x < 0 || y < 0 || y >= this.lines.length)
            return CELLTYPES.AIR;

        const line = this.lines[y];
        if (x >= line.length)
            return CELLTYPES.AIR;

        return line[x];
    }

    draw_cell(params, x, y) {
        function rect() {
            params.ctx.fillRect(
                x * params.cell_width,
                y * params.cell_height,
                params.cell_width,
                params.cell_height
            );
        }
        const cell = this.get_cell(x, y);
        switch(cell) {
            // cells that don't draw anything
            case '-':
            case '|':
            case ' ': break;

            case '%':
            case '=': {
                params.ctx.fillStyle = "#000000";
                rect();
                break;
            };

            case '@': {
                // TODO
                break;
            }

            case '~': {
                params.ctx.fillStyle = "#00D8FF";
                rect();
                break;
            }

            case '*': {
                // TODO
                break;
            }

            case '^': {
                params.ctx.fillStyle = "#000000";
                params.ctx.fillRect(
                    x * params.cell_width + 2 * params.cell_width / 5,
                    y * params.cell_height,
                    params.cell_width / 5,
                    params.cell_height
                );

                params.ctx.fillStyle = "#22E263";
                params.ctx.fillRect(
                    x * params.cell_width + 3 * params.cell_width / 5,
                    y * params.cell_height,
                    2 * params.cell_width / 5,
                    params.cell_height / 3
                );

                break;
            }

            default: {
                // if (cell is uppercase letter)
                // if (cell is lowercase letter)
                // else if (cell is digit)
                break;
            }
        }
    }

    drawLevel(params) {
        params.ctx.clearRect(0, 0, params.ctx.canvas.width, params.ctx.canvas.height);
        for (let y = 0; y < this.dimensions[1]; y++)
            for (let x = 0; x < this.dimensions[0]; x++)
                this.draw_cell(params, x, y);
    }
}

/**
 * buffer 0 - draw static parts of level
 * while on this level:
 *   buffer 1 - draw buffer 0
 *   buffer 1 - draw toggled on (%) parts of level
 *   buffer 1 - draw buttons, keys and checkpoints
 *   buffer 1 - draw character
 *   buffer 1 - draw moving platforms
 *
 *   listen for input
 *   move character and check for collisions / status effects
 */

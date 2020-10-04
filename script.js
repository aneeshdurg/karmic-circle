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
    SPAWN: '^',
    GOAL: '#',
    isKey: (c) => Boolean(c.match("[a-z]")),
    isLock: (c) => Boolean(c.match("[A-Z]")),
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
            return CELLTYPES.GROUND;

        const line = this.lines[y];
        if (x >= line.length)
            return CELLTYPES.GROUND;

        return line[x];
    }

    find_spawn() {
        for (let y = 0; y < this.dimensions[1]; y++)
            for (let x = 0; x < this.dimensions[0]; x++)
                if (this.get_cell(x, y) == CELLTYPES.SPAWN)
                    return [x, y];
    }

    get_environ_cell(x, y) {
        const cell = this.get_cell(x, y);
        // TODO look at state of locks and conditional ground as well.
        if (cell != CELLTYPES.GROUND && cell != CELLTYPES.WATER)
            return CELLTYPES.AIR;

        return cell;
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

            case '#': {
                params.ctx.fillStyle = "#FFD700";
                rect();
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

STATE = {
    HUMAN: "human",
    FISH: "fish",
    BIRD: "bird",
    WORM: "worm",
}

CAUSES = {
    DROWNING: 0,
    FALLING: 1,
    SUFFOCATE: 2,
}

class Game {
    player_coords = [0, 4];
    player_velocity = [0, 0];
    player_state = STATE.HUMAN;

    spawn_point = [0, 0];

    levellist = [
        "start",
        "falling",
    ]

    levelidx = 0;

    constructor(container) {
        const canvas = document.createElement("canvas");
        container.appendChild(canvas);
        const hud = document.createElement("div");
        container.appendChild(hud);

        this.hpbar = document.createElement("progress");
        this.hpbar.max = 100;
        this.hpbar.value = 100;
        hud.appendChild(this.hpbar);

        this.keymap = new Map();
        const that = this;
        document.addEventListener("keydown", e => {
            if (e.key.includes("Arrow"))
                e.preventDefault();
            if (!that.keymap.has(e.key))
                that.keymap.set(e.key, (new Date()).getTime());
        });
        document.addEventListener("keyup", e => {
            if (e.key.includes("Arrow"))
                e.preventDefault();
            that.keymap.delete(e.key);
        });

        const margin = 5;
        canvas.width = 200 + margin * 2;
        canvas.height = 200 + margin * 2;
        const ctx = canvas.getContext("2d");
        ctx.translate(5, 5);

        this.params = new DrawParams(ctx, 20, 20);
        this.level = new Level(this.levellist[this.levelidx]);

        this.player_coords[0] *= this.params.cell_width;
        this.player_coords[1] *= this.params.cell_height;

        this.spawn_point = [...this.player_coords];

        this.set_human_params();

        this.gravity = this.params.cell_height / 10;
    }

    set_human_params() {
        this.player_state = STATE.HUMAN;
        this.player_height = 3 * this.params.cell_height / 4;
        this.player_width = this.params.cell_width / 5;
    }

    set_fish_params() {
        this.player_state = STATE.FISH;
        this.player_height = this.params.cell_height / 4;
        this.player_width = 2 * this.params.cell_width / 3;
    }

    set_bird_params() {
        this.player_state = STATE.BIRD;
        this.player_height = this.params.cell_height / 4;
        this.player_width = 2 * this.params.cell_width / 3;
    }

    toCellCoords(screen_coords) {
        const raw_coords =  [screen_coords[0] / this.params.cell_width, screen_coords[1] / this.params.cell_height];
        return raw_coords.map(c => Math.floor(c))
    }

    getPlayerBoundingBox() {
        const top_left = [...this.player_coords];
        const top_left_cell = this.toCellCoords(top_left);
        const top_right = [this.player_coords[0] + this.player_width, this.player_coords[1]];
        const top_right_cell = this.toCellCoords(top_right);

        const bottom_left = [top_left[0], this.player_coords[1] + this.player_height];
        const bottom_left_cell = this.toCellCoords(bottom_left);
        const bottom_right = [top_right[0], this.player_coords[1] + this.player_height];
        const bottom_right_cell = this.toCellCoords(bottom_right);

        const bottom_left_clip = [top_left[0], this.player_coords[1] + this.player_height - 1];
        const bottom_left_clip_cell = this.toCellCoords(bottom_left_clip);
        const bottom_right_clip = [top_right[0], this.player_coords[1] + this.player_height - 1];
        const bottom_right_clip_cell = this.toCellCoords(bottom_right_clip);

        return {
            screen: {
                top_left: top_left,
                top_right: top_right,
                bottom_left: bottom_left,
                bottom_right: bottom_right,
                bottom_left_clip: bottom_left_clip,
                bottom_right_clip: bottom_right_clip,
            },
            cell: {
                top_left: top_left_cell,
                top_right: top_right_cell,
                bottom_left: bottom_left_cell,
                bottom_right: bottom_right_cell,
                bottom_left_clip: bottom_left_clip_cell,
                bottom_right_clip: bottom_right_clip_cell,
            },
        };
    }

    playerIsClipping() {
        const bbox = this.getPlayerBoundingBox();
        const top_left_clip = this.level.get_environ_cell(...bbox.cell.top_left) == CELLTYPES.GROUND;
        const top_right_clip = this.level.get_environ_cell(...bbox.cell.top_right) == CELLTYPES.GROUND;
        const bottom_left_clip = this.level.get_environ_cell(...bbox.cell.bottom_left_clip) == CELLTYPES.GROUND;
        const bottom_right_clip = this.level.get_environ_cell(...bbox.cell.bottom_right_clip) == CELLTYPES.GROUND;
        return (top_left_clip || top_right_clip || bottom_left_clip || bottom_right_clip);
    }

    update_physics() {
        // This will control moving platforms:
        // this.level.tick();

        if (this.keymap.has("ArrowRight"))
            this.player_velocity[0] += this.params.cell_width / 5;
        if (this.keymap.has("ArrowLeft"))
            this.player_velocity[0] -= this.params.cell_width / 5;

        const bbox = this.getPlayerBoundingBox();


        { // check corners for collision with sides
            if (this.level.get_environ_cell(...bbox.cell.top_left) == CELLTYPES.GROUND ||
                this.level.get_environ_cell(bbox.cell.bottom_left[0], bbox.cell.bottom_left[1] - 1) == CELLTYPES.GROUND)
                this.player_velocity[0] = Math.max(this.player_velocity[0], 0);
            if (this.level.get_environ_cell(...bbox.cell.top_right) == CELLTYPES.GROUND)
                this.player_velocity[0] = Math.min(this.player_velocity[0], 0);
        }

        { // check corners for collision with ground
            if (this.level.get_environ_cell(...bbox.cell.bottom_left) != CELLTYPES.GROUND &&
                this.level.get_environ_cell(...bbox.cell.bottom_right) != CELLTYPES.GROUND) {
                this.player_velocity[1] += this.gravity;

                if (this.player_state == STATE.BIRD && this.keymap.has("ArrowUp"))
                    this.player_velocity[1] -= 2 * this.gravity;
            } else {
                if (this.player_velocity[1] > 5 * this.gravity) {
                    this.cause = CAUSES.FALLING;
                    this.hpbar.value = 0;
                }

                this.player_velocity[1] = Math.min(this.player_velocity[1], 0);
                let jumpVel = this.params.cell_height / 2;
                if (this.player_state == STATE.FISH)
                    jumpVel /= 2;

                if (this.keymap.has("ArrowUp"))
                    this.player_velocity[1] -= jumpVel;
            }
        }

        const inWater = this.level.get_environ_cell(...bbox.cell.bottom_left_clip) == CELLTYPES.WATER;

        if (inWater) {
            this.player_velocity[1] -= this.gravity / 2;
            if (this.player_state == STATE.FISH) { // Fish aren't affect by gravity while in water
                this.player_velocity[1] -= this.gravity / 2;
                if (this.keymap.has("ArrowUp"))
                    this.player_velocity[1] -= this.params.cell_height / 5;
                if (this.keymap.has("ArrowDown"))
                    this.player_velocity[1] += this.params.cell_height / 5;
            } else {
                this.hpbar.value--;
                this.cause = CAUSES.DROWNING;
            }
        } else {
            if (this.player_state == STATE.FISH) {
                this.hpbar.value--;
                this.cause = CAUSES.SUFFOCATE;
            }
        }

        // add velocity
        const that = this;
        function add_velocity(velocity) {
            that.player_coords = that.player_coords.map((x, i) => x + velocity[i]);
        }

        add_velocity(this.player_velocity);

        // prevent clipping
        let count = 0;
        while (this.playerIsClipping()) {
            add_velocity(this.player_velocity.map(x => -0.01 * x));
            count++;
            if (count > 100) {
                console.log("???", this.player_coords);
                break;
            }
        }

        this.player_velocity[0] = 0;
        if (this.player_state == STATE.FISH && inWater)
            this.player_velocity[1] = 0;
        else {
            if (this.player_velocity[1] < 0) {
                this.player_velocity[1] /= 2;
                if (this.player_velocity[1] < -1 * this.params.cell_height / 100)
                    this.player_velocity[1] = 0;
            }
        }
    }

    draw_player() {
        if (this.player_state == STATE.HUMAN) {
            this.params.ctx.fillStyle = "#FF0000";
            this.params.ctx.fillRect(
                this.player_coords[0],
                this.player_coords[1],
                this.player_width,
                this.player_height
            );
        } else if (this.player_state == STATE.FISH) {
            const positive_vel = this.player_velocity[0] >= 0;
            const offset = positive_vel ? this.player_width / 3 : 0;
            this.params.ctx.fillStyle = "#0000FF";
            this.params.ctx.fillRect(
                this.player_coords[0] + offset,
                this.player_coords[1],
                2 * this.player_width / 3,
                this.player_height
            );

            this.params.ctx.beginPath();
            if (positive_vel) {
                this.params.ctx.moveTo(this.player_coords[0] + this.player_width / 3, this.player_coords[1] + this.player_height / 2);
                this.params.ctx.lineTo(this.player_coords[0], this.player_coords[1]);
                this.params.ctx.lineTo(this.player_coords[0], this.player_coords[1] + this.player_height);
                this.params.ctx.fill();
            } else {
                this.params.ctx.moveTo(this.player_coords[0] + 2 * this.player_width / 3, this.player_coords[1] + this.player_height / 2);
                this.params.ctx.lineTo(this.player_coords[0] + this.player_width, this.player_coords[1]);
                this.params.ctx.lineTo(this.player_coords[0] + this.player_width, this.player_coords[1] + this.player_height);
                this.params.ctx.fill();
            }
        } else if (this.player_state == STATE.BIRD) {
            // TODO this doesn't look like a bird!!!
            this.params.ctx.fillStyle = "#FF00FF";
            this.params.ctx.fillRect(
                this.player_coords[0],
                this.player_coords[1],
                this.player_width,
                this.player_height
            );
        }
    }

    setSpawn() {
        const spawn_cell = this.level.find_spawn();
        this.spawn_point = [spawn_cell[0] * this.params.cell_width, spawn_cell[1] * this.params.cell_height];
    }

    async nextlevel() {
        this.levelidx++;
        if (this.levelidx >= this.levellist.length) {
            alert("You beat the game!");
            throw new Error("whatever");
        }

        this.level = new Level(this.levellist[this.levelidx]);
        await this.level.initialize();
        this.setSpawn();
        this.set_human_params();
        this.reset();
    }

    reset() {
        this.keymap = new Map();
        this.hpbar.value = 100;
        this.player_coords = [...this.spawn_point];
    }

    async run() {
        await this.level.initialize();
        const that = this;
        async function render() {
            that.update_physics();
            that.level.drawLevel(that.params);
            that.draw_player();
            if (that.level.get_cell(...that.toCellCoords(that.player_coords)) == CELLTYPES.GOAL) {
                alert("You did it!");
                await that.nextlevel();
                render();
            } else if (that.hpbar.value == 0) {
                if (that.cause == CAUSES.DROWNING)
                    that.set_fish_params();
                else if (that.cause == CAUSES.SUFFOCATE)
                    that.set_human_params();
                else if (that.cause == CAUSES.FALLING)
                    that.set_bird_params();

                that.params.ctx.fillStyle = "#FF000050";
                that.params.ctx.fillRect(
                    0,
                    0,
                    that.params.ctx.canvas.width,
                    that.params.ctx.canvas.height
                );

                setTimeout(() => {
                    alert(`You died! You shall be reborn as as ${that.player_state}`);
                    that.reset();

                    setTimeout(render, 5 * 1000 / 30);
                }, 100);
            } else {
                setTimeout(render, 1000 / 30);
            }
        }

        render();
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

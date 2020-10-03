class Result {
    constructor(name, passed) {
        this.name = name;
        this.passed = passed;
    }
}

function test(name, test_fn) {
    return async () => {
        try {
         return new Result(name, await test_fn());
        } catch(e) {
            console.log(e);
            return new Result(name, false);
        }
    }
}

tests = [
    test('basic level loading', async () => {
        const lvl = new Level('../start');
        await lvl.initialize();
        return lvl.dimensions[0] == 10 && lvl.dimensions[1] == 10;
    }),
];

(async () => {
    for (let test of tests) {
        const res = await test();
        if (res.passed)
            console.log(`'${res.name}' passed!`);
        else
            console.error(`'${res.name}' failed!`);
    }
})();

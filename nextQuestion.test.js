const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf-8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const scriptContent = scriptMatch[1];

// Mock DOM
global.document = {
    getElementById: (id) => ({
        children: [],
        classList: { add: () => {}, remove: () => {} },
        style: {},
        querySelectorAll: () => [],
        appendChild: () => {}
    }),
    createElement: () => ({
        style: {},
        classList: { add: () => {}, remove: () => {} }
    })
};
global.window = {
    AudioContext: function() {},
    webkitAudioContext: function() {}
};

test('nextQuestion function', async (t) => {
    let endResult = null;
    let renderCalled = false;
    let renderedQuestion = null;

    // Evaluate the script in a function to keep it scoped, or just use eval
    let testScope = `
        ${scriptContent}

        // Expose functions and state to the outer scope for testing
        global.nextQuestion = nextQuestion;
        global.state = state;
        global.questionsDB = questionsDB;

        // Mock dependencies
        showEnd = function(type) {
            endResult = type;
        };
        renderQuestion = function(q) {
            renderCalled = true;
            renderedQuestion = q;
        };
    `;

    eval(testScope);

    await t.test('should show win screen when score >= 10', () => {
        endResult = null;
        global.state.score = 10;
        global.state.lives = 3;
        global.nextQuestion();
        assert.strictEqual(endResult, 'win');
    });

    await t.test('should show win screen when score > 10', () => {
        endResult = null;
        global.state.score = 15;
        global.state.lives = 3;
        global.nextQuestion();
        assert.strictEqual(endResult, 'win');
    });

    await t.test('should show lose screen when lives <= 0', () => {
        endResult = null;
        global.state.score = 5;
        global.state.lives = 0;
        global.nextQuestion();
        assert.strictEqual(endResult, 'lose');
    });

    await t.test('should show lose screen when lives < 0', () => {
        endResult = null;
        global.state.score = 5;
        global.state.lives = -1;
        global.nextQuestion();
        assert.strictEqual(endResult, 'lose');
    });

    await t.test('should pick a question from pool and render it when game continues', () => {
        endResult = null;
        renderCalled = false;
        renderedQuestion = null;

        global.state.score = 5;
        global.state.lives = 3;
        global.state.pool = [
            {t: 'Q1', o: ['1'], c: 0},
            {t: 'Q2', o: ['2'], c: 0}
        ];

        const initialPoolLength = global.state.pool.length;

        global.nextQuestion();

        assert.strictEqual(endResult, null, 'showEnd should not be called');
        assert.strictEqual(global.state.pool.length, initialPoolLength - 1, 'Question should be removed from pool');
        assert.strictEqual(renderCalled, true, 'renderQuestion should be called');
        assert.ok(renderedQuestion, 'A question should be passed to renderQuestion');
    });
});

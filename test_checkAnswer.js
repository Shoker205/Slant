const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

test('checkAnswer tests', async (t) => {
    let html = fs.readFileSync('index.html', 'utf8');

    // Replace some let with window scoped variables to make it accessible
    html = html.replace('let state = {', 'window.state = {');
    html = html.replace('const el = {', 'window.el = {');
    html = html.replace('let audioCtx;', 'window.audioCtx = null;');

    const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        url: 'http://localhost/',
        pretendToBeVisual: true
    });

    const win = dom.window;

    // Inject mock functions to intercept sound and UI calls
    win.eval(`
        window.playCorrectSoundCalled = false;
        window.playCorrectSound = function() { window.playCorrectSoundCalled = true; };

        window.playWrongSoundCalled = false;
        window.playWrongSound = function() { window.playWrongSoundCalled = true; };

        window.updateStatsCalled = false;
        window.updateStats = function() { window.updateStatsCalled = true; };

        window.nextQuestionCalled = false;
        window.nextQuestion = function() { window.nextQuestionCalled = true; };

        // Expose checkAnswer
        window.checkAnswerFunc = checkAnswer;
    `);

    // Helper to setup/reset state for each test
    function setupTestState(isTyping = false) {
        win.state.isTyping = isTyping;
        win.state.score = 0;
        win.state.lives = 3;
        win.state.pool = [{ t: "Q1", o: ["A", "B", "C", "D"], c: 1 }];

        win.playCorrectSoundCalled = false;
        win.playWrongSoundCalled = false;
        win.updateStatsCalled = false;
        win.nextQuestionCalled = false;

        win.el.grid.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const btn = win.document.createElement('button');
            btn.className = 'mc-button';
            win.el.grid.appendChild(btn);
        }
    }

    await t.test('returns early if state.isTyping is true', () => {
        setupTestState(true);
        const buttons = win.el.grid.querySelectorAll('.mc-button');

        win.checkAnswerFunc(1, 1);

        // Assert nothing happened
        assert.strictEqual(buttons[0].disabled, false);
        assert.strictEqual(win.playCorrectSoundCalled, false);
    });

    await t.test('handles correct answer', async () => {
        setupTestState(false);
        const buttons = win.el.grid.querySelectorAll('.mc-button');

        win.checkAnswerFunc(1, 1);

        // Immediate side effects
        buttons.forEach(b => assert.strictEqual(b.disabled, true));
        assert.strictEqual(win.playCorrectSoundCalled, true);
        assert.strictEqual(buttons[1].classList.contains('correct'), true);
        assert.strictEqual(win.state.score, 1);

        // Delayed side effects
        await new Promise(r => setTimeout(r, 1250));
        assert.strictEqual(win.updateStatsCalled, true);
        assert.strictEqual(win.nextQuestionCalled, true);
    });

    await t.test('handles wrong answer', async () => {
        setupTestState(false);
        const buttons = win.el.grid.querySelectorAll('.mc-button');

        win.checkAnswerFunc(0, 1);

        // Immediate side effects
        buttons.forEach(b => assert.strictEqual(b.disabled, true));
        assert.strictEqual(win.playWrongSoundCalled, true);
        assert.strictEqual(buttons[0].classList.contains('wrong'), true);
        assert.strictEqual(buttons[1].classList.contains('correct'), true);
        assert.strictEqual(win.state.lives, 2);
        assert.strictEqual(win.el.card.classList.contains('shake'), true);

        // Delayed side effects
        await new Promise(r => setTimeout(r, 1850));
        assert.strictEqual(win.el.card.classList.contains('shake'), false);
        assert.strictEqual(win.updateStatsCalled, true);
        assert.strictEqual(win.nextQuestionCalled, true);
    });
});

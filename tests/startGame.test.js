const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

describe('startGame function', () => {
    let dom;
    let window;

    beforeEach((done) => {
        // Remove fonts loading to avoid JSDOM errors
        const cleanedHtml = html.replace(/<link href="https:\/\/fonts.googleapis.com[^>]*>/, '');

        dom = new JSDOM(cleanedHtml, { runScripts: 'dangerously' });
        window = dom.window;

        // Wait for script to execute
        setTimeout(() => {
            done();
        }, 100);
    });

    test('should reset state correctly and trigger game updates', () => {
        // Modify state before starting game using eval since `let` does not attach to window directly
        window.eval(`
            state.score = 5;
            state.lives = 1;
            state.pool = [];

            // Overwrite functions to spy on them
            window.updateStatsCalled = false;
            window.nextQuestionCalled = false;

            const originalUpdateStats = updateStats;
            const originalNextQuestion = nextQuestion;

            updateStats = function() { window.updateStatsCalled = true; };
            nextQuestion = function() { window.nextQuestionCalled = true; };

            // Execute the function
            startGame();

            // Restore functions
            updateStats = originalUpdateStats;
            nextQuestion = originalNextQuestion;
        `);

        // Verify state is reset
        const currentState = window.eval('state');
        const db = window.eval('questionsDB');

        expect(currentState.score).toBe(0);
        expect(currentState.lives).toBe(3);
        expect(currentState.pool.length).toBe(db.length);
        expect(currentState.pool).toEqual(db);

        // Verify functions were called
        expect(window.updateStatsCalled).toBe(true);
        expect(window.nextQuestionCalled).toBe(true);
    });
});

// 状態管理
const state = {
    settings: {
        gasUrl: '',
        geminiKey: '',
        questionCount: 3
    },
    rawQuestions: [],
    quizQuestions: [],
    currentQuestionIndex: 0,
    answersContext: [], // For sending completion back to GAS
    history: [] // Saved locally
};

// DOM Elements
const views = {
    dashboard: document.getElementById('dashboard-view'),
    quiz: document.getElementById('quiz-view'),
    loading: document.getElementById('loading-view'),
    result: document.getElementById('result-view')
};

const dom = {
    // Dashboard
    startBtn: document.getElementById('start-quiz-btn'),
    todayCount: document.getElementById('today-tasks-count'),
    dashStatus: document.getElementById('dashboard-status'),

    // Quiz
    questionText: document.getElementById('question-text'),
    answerInput: document.getElementById('answer-input'),
    submitAnswerBtn: document.getElementById('submit-answer-btn'),
    quizProgress: document.getElementById('quiz-progress-fill'),
    currentQNum: document.getElementById('current-q-num'),
    totalQNum: document.getElementById('total-q-num'),

    // Result
    resCurrentQNum: document.getElementById('res-current-q-num'),
    resTotalQNum: document.getElementById('res-total-q-num'),
    aiScore: document.getElementById('ai-score'),
    aiFeedback: document.getElementById('ai-feedback-text'),
    userAnswerDisplay: document.getElementById('user-answer-display'),
    correctAnswerDisplay: document.getElementById('correct-answer-display'),
    nextBtn: document.getElementById('next-question-btn'),
    finishBtn: document.getElementById('finish-quiz-btn'),

    // Settings
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    gasUrlInput: document.getElementById('gas-url'),
    geminiKeyInput: document.getElementById('gemini-key'),
    qCountInput: document.getElementById('question-count'),

    // History
    historyBtn: document.getElementById('history-btn'),
    historyModal: document.getElementById('history-modal'),
    closeHistoryBtn: document.getElementById('close-history-btn'),
    historyList: document.getElementById('history-list'),

    // List
    listBtn: document.getElementById('list-btn'),
    listModal: document.getElementById('list-modal'),
    closeListBtn: document.getElementById('close-list-btn'),
    dataList: document.getElementById('data-list'),
};

// 初期化処理
function init() {
    initParticles();
    loadSettings();
    bindEvents();

    // ダミーデータでテスト表示（本番ではGASから取得）
    simulateFetchData();
}

function initParticles() {
    if (window.particlesJS) {
        particlesJS('particles-js', {
            "particles": {
                "number": { "value": 40, "density": { "enable": true, "value_area": 800 } },
                "color": { "value": "#6366f1" },
                "shape": { "type": "circle" },
                "opacity": { "value": 0.4, "random": true },
                "size": { "value": 4, "random": true },
                "line_linked": { "enable": true, "distance": 150, "color": "#6366f1", "opacity": 0.2, "width": 1 },
                "move": { "enable": true, "speed": 1, "direction": "none", "random": true, "out_mode": "out" }
            },
            "interactivity": { "events": { "onhover": { "enable": false }, "onclick": { "enable": false } } },
            "retina_detect": true
        });
    }
}

function loadSettings() {
    const saved = localStorage.getItem('chronoSettings');
    if (saved) {
        state.settings = JSON.parse(saved);
        dom.gasUrlInput.value = state.settings.gasUrl;
        dom.geminiKeyInput.value = state.settings.geminiKey || '';
        dom.qCountInput.value = state.settings.questionCount || 3;
    }

    const savedHistory = localStorage.getItem('chronoHistoryLog');
    if (savedHistory) {
        state.history = JSON.parse(savedHistory);
        renderHistory();
    }

    const cachedData = localStorage.getItem('chronoDataCache');
    if (cachedData) {
        state.rawQuestions = JSON.parse(cachedData);
        processRawQuestions();
    }
}

function saveSettings() {
    state.settings = {
        gasUrl: dom.gasUrlInput.value.trim(),
        geminiKey: dom.geminiKeyInput.value.trim(),
        questionCount: parseInt(dom.qCountInput.value) || 3
    };
    localStorage.setItem('chronoSettings', JSON.stringify(state.settings));
    dom.settingsModal.classList.remove('open');
    showToast('設定を保存しました');

    // 再読み込み
    simulateFetchData();
}

function bindEvents() {
    // Settings
    dom.settingsBtn.addEventListener('click', () => dom.settingsModal.classList.add('open'));
    dom.closeSettingsBtn.addEventListener('click', () => dom.settingsModal.classList.remove('open'));
    dom.saveSettingsBtn.addEventListener('click', saveSettings);

    // List
    dom.listBtn.addEventListener('click', () => {
        renderList();
        dom.listModal.classList.add('open');
    });
    dom.closeListBtn.addEventListener('click', () => dom.listModal.classList.remove('open'));

    // History
    dom.historyBtn.addEventListener('click', () => {
        renderHistory();
        dom.historyModal.classList.add('open');
    });
    dom.closeHistoryBtn.addEventListener('click', () => dom.historyModal.classList.remove('open'));

    // Quiz Flow
    dom.startBtn.addEventListener('click', startQuiz);
    dom.submitAnswerBtn.addEventListener('click', submitAnswer);
    dom.nextBtn.addEventListener('click', showNextQuestion);
    dom.finishBtn.addEventListener('click', finishQuiz);
}

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---------------------------
// App Flow Logic
// ---------------------------

async function simulateFetchData() {
    if (!state.settings.gasUrl) {
        dom.dashStatus.textContent = '設定からGASのURLを入力してください。';
        return;
    }

    // Check if we have cached data first to prevent layout jumping
    if (state.rawQuestions.length === 0) {
        dom.dashStatus.textContent = '🔄 データを読み込んでいます...';
        dom.startBtn.disabled = true;
    } else {
        dom.dashStatus.textContent = '☁️ 最新データをバックグラウンドで同期中...';
    }

    try {
        const response = await fetch(state.settings.gasUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        state.rawQuestions = data;
        localStorage.setItem('chronoDataCache', JSON.stringify(data));

        processRawQuestions();
    } catch (error) {
        console.error('Fetching error:', error);
        if (state.rawQuestions.length > 0) {
            dom.dashStatus.textContent = '⚠️ 同期に失敗しました（前回のデータを表示中）';
        } else {
            dom.dashStatus.textContent = 'データの取得に失敗しました。URLを確認してください。';
        }
    }
}

function processRawQuestions() {
    const incomplete = state.rawQuestions.filter(q => {
        if (q.status !== '未完了') return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (q.reviewDate) {
            const rd = new Date(q.reviewDate);
            if (!isNaN(rd)) {
                return rd <= today;
            }
        }
        return true;
    });

    const count = Math.min(incomplete.length, state.settings.questionCount);

    // Random Selection
    state.quizQuestions = [...incomplete].sort(() => 0.5 - Math.random()).slice(0, count);

    dom.todayCount.textContent = state.quizQuestions.length;
    if (state.quizQuestions.length > 0) {
        dom.dashStatus.textContent = '✅ 最新データで準備完了！';
        dom.startBtn.disabled = false;
    } else {
        dom.dashStatus.textContent = '🎉 今日の復習対象はありません。素晴らしい！';
        dom.startBtn.disabled = true;
    }
}

function startQuiz() {
    state.currentQuestionIndex = 0;
    state.answersContext = [];
    renderQuizQuestion();
    switchView('quiz');
}

function renderQuizQuestion() {
    const q = state.quizQuestions[state.currentQuestionIndex];
    dom.currentQNum.textContent = state.currentQuestionIndex + 1;
    dom.totalQNum.textContent = state.quizQuestions.length;

    const progressPercent = ((state.currentQuestionIndex) / state.quizQuestions.length) * 100;
    dom.quizProgress.style.width = `${progressPercent}%`;

    dom.questionText.textContent = q.question;
    dom.answerInput.value = '';
    dom.answerInput.focus();
}

async function submitAnswer() {
    const userAnswer = dom.answerInput.value.trim();
    if (!userAnswer) {
        showToast('回答を入力してください');
        return;
    }

    switchView('loading');

    const q = state.quizQuestions[state.currentQuestionIndex];

    if (!state.settings.geminiKey) {
        // AIなしのフォールバック
        setTimeout(() => showResult(userAnswer, 0, "Gemini APIキーが設定されていないため、添削はスキップされました。自己採点してください。"), 1000);
        return;
    }

    const promptText = `
あなたはプロのIT学習メンターです。以下の「問題」「模範解答（および解説）」と、生徒の「回答」を比較し、添削を行ってください。
必ず以下のJSON形式でのみ出力してください（不要なバッククォートやマークダウンは除外してください）。
{
  "score": 採点スコア（0〜100の整数）,
  "feedback": "生徒への建設的で分かりやすいフィードバック（数行程度）"
}

問題: ${q.question}
模範解答・解説: ${q.answer}
生徒の回答: ${userAnswer}
`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.settings.geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) throw new Error('Gemini API Error');
        const data = await response.json();

        const candidateText = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(candidateText);

        showResult(userAnswer, result.score || 0, result.feedback || "添削に失敗しました。");
    } catch (error) {
        console.error('AI error:', error);
        showResult(userAnswer, 0, "AI添削中にエラーが発生しました。");
    }
}

function showResult(userAnswer, score, feedback) {
    const q = state.quizQuestions[state.currentQuestionIndex];

    dom.resCurrentQNum.textContent = state.currentQuestionIndex + 1;
    dom.resTotalQNum.textContent = state.quizQuestions.length;

    const progressPercent = ((state.currentQuestionIndex + 1) / state.quizQuestions.length) * 100;
    dom.quizProgress.style.width = `${progressPercent}%`;

    dom.aiScore.textContent = score;
    dom.userAnswerDisplay.textContent = userAnswer;
    dom.correctAnswerDisplay.textContent = q.answer;

    dom.aiFeedback.textContent = feedback;

    // For gas update later
    state.answersContext.push({
        row: q.row,
        question: q.question,
        userAnswer: userAnswer,
        score: score,
        feedback: feedback
    });

    if (state.currentQuestionIndex === state.quizQuestions.length - 1) {
        dom.nextBtn.style.display = 'none';
        dom.finishBtn.style.display = 'flex';
    } else {
        dom.nextBtn.style.display = 'flex';
        dom.finishBtn.style.display = 'none';
    }

    switchView('result');
}

function showNextQuestion() {
    state.currentQuestionIndex++;
    renderQuizQuestion();
    switchView('quiz');
}

async function finishQuiz() {
    dom.startBtn.disabled = true;
    dom.startBtn.classList.remove('pulse');
    dom.dashStatus.textContent = 'スプレッドシートを更新中...';
    switchView('dashboard');

    try {
        if (!state.settings.gasUrl || state.answersContext.length === 0) return;

        const response = await fetch(state.settings.gasUrl, {
            method: 'POST',
            body: JSON.stringify({ updates: state.answersContext }),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            }
        });

        dom.todayCount.textContent = '0';
        dom.dashStatus.textContent = 'お疲れ様でした！今日の復習は完了です。';
        showToast('スプレッドシートのステータスを更新しました');

        // Save to Local History
        const dateStr = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
        state.answersContext.forEach(ctx => {
            state.history.unshift({
                date: dateStr,
                question: ctx.question,
                score: ctx.score,
                feedback: ctx.feedback
            });
        });
        localStorage.setItem('chronoHistoryLog', JSON.stringify(state.history));
        renderHistory();

    } catch (error) {
        console.error('Update error:', error);
        dom.dashStatus.textContent = '復習は完了しましたが、シートの更新に失敗しました。';
        showToast('エラー: 更新に失敗しました');
    }
}

function renderHistory() {
    if (!state.history || state.history.length === 0) {
        dom.historyList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">履歴がありません</p>';
        return;
    }

    dom.historyList.innerHTML = state.history.map(h => `
        <div class="history-item">
            <div class="history-date"><i class='bx bx-time-five'></i> ${h.date}</div>
            <div class="history-score">Score: ${h.score}/100</div>
            <div class="history-question">${h.question}</div>
            <div class="history-feedback">${h.feedback}</div>
        </div>
    `).join('');
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init);

function renderList() {
    if (!state.rawQuestions || state.rawQuestions.length === 0) {
        dom.dataList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">データがありません</p>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const itemsHtml = state.rawQuestions.map(q => {
        let daysPassedText = '-';
        if (q.reviewDate) {
            const rd = new Date(q.reviewDate);
            if (!isNaN(rd)) {
                const diffTime = rd - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays < 0) daysPassedText = `予定日から ${Math.abs(diffDays)}日 経過`;
                else if (diffDays === 0) daysPassedText = `今日が復習日`;
                else daysPassedText = `あと ${diffDays}日`;
            }
        } else if (q.date) {
            const dStr = new Date(q.date);
            if (!isNaN(dStr)) {
                const diffTime = today - dStr;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                daysPassedText = `登録から ${diffDays}日 経過`;
            }
        }

        const isCompleted = q.status === '完了';

        const actionBtn = isCompleted
            ? `<button class="reset-btn" onclick="markIncomplete(${q.row})"><i class='bx bx-reset'></i>未完了に戻す</button>`
            : ``;

        const statusBadge = isCompleted
            ? `<span class="status-badge success">完了</span>`
            : `<span class="status-badge warning">未完了</span>`;

        const dDisp = q.date ? new Date(q.date).toLocaleDateString() : '日付なし';

        return `
            <div class="list-item">
                <div class="list-header" style="align-items: center;">
                    <span class="list-topic">${q.topic || 'No Title'}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${actionBtn}
                        ${statusBadge}
                    </div>
                </div>
                <div class="list-meta">
                    <span class="meta-date"><i class='bx bx-calendar'></i> ${dDisp}</span>
                    <span class="meta-days"><i class='bx bx-time'></i> ${daysPassedText}</span>
                </div>
            </div>
        `;
    }).join('');

    dom.dataList.innerHTML = itemsHtml;
}

window.markIncomplete = async function (rowNum) {
    if (!state.settings.gasUrl) return;

    // UI Feedback
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> 更新中...`;
    btn.disabled = true;

    try {
        const response = await fetch(state.settings.gasUrl, {
            method: 'POST',
            body: JSON.stringify({ updates: [{ row: rowNum, action: 'mark_incomplete' }] }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        if (!response.ok) throw new Error('API Error');

        showToast('未完了に戻しました！');

        // 再フェッチして一覧を更新
        await simulateFetchData();
        renderList();
    } catch (err) {
        console.error(err);
        showToast('エラー: 更新に失敗しました');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

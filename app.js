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
    history: [], // Saved locally
    currentGeneratedData: null,
    selectedChoices: new Set()
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
    choicesContainer: document.getElementById('choices-container'),
    submitAnswerBtn: document.getElementById('submit-answer-btn'),
    
    // Loading
    loadingTitle: document.getElementById('loading-title'),
    loadingDesc: document.getElementById('loading-desc'),
    quizProgress: document.getElementById('quiz-progress-fill'),
    currentQNum: document.getElementById('current-q-num'),
    totalQNum: document.getElementById('total-q-num'),

    // Result
    resCurrentQNum: document.getElementById('res-current-q-num'),
    resTotalQNum: document.getElementById('res-total-q-num'),
    aiScore: document.getElementById('ai-score'),
    optionsDisplay: document.getElementById('options-display'),
    explanationDisplay: document.getElementById('explanation-display'),
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

async function startQuiz() {
    state.currentQuestionIndex = 0;
    state.answersContext = [];
    await generateAndShowQuestion();
}

async function generateAndShowQuestion() {
    switchView('loading');
    dom.loadingTitle.textContent = 'AIが問題を作成中...';
    dom.loadingDesc.textContent = 'トピックに合わせた最適な4択問題を生成しています。少々お待ちください。';

    const q = state.quizQuestions[state.currentQuestionIndex];
    
    if (!state.settings.geminiKey) {
        state.currentGeneratedData = {
            question: q.question || "ダミー問題: 次のうち正しいものをすべて選んでください。",
            choices: ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
            correctIndices: [0, 2],
            explanation: "APIキーが設定されていないためダミーデータです。"
        };
        renderQuizQuestion();
        switchView('quiz');
        return;
    }

    const promptText = `
あなたはプロのIT学習メンターであり、クイズ作成者です。
生徒の復習トピック「${q.topic || q.question}」（可能なら元の模範解答の文脈「${q.answer || ''}」も考慮）に基づいて、新しく「4択問題」を1つ作成してください。
正解となる選択肢の数は「1個〜4個」のいずれかでランダムになるように設定してください。

必ず以下のJSON形式でのみ出力してください（不要なバッククォートやマークダウンは除外してください）。
{
  "question": "生徒に出題する問題文",
  "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
  "correctIndices": [0, 2], // 正解となる選択肢のインデックス（0始まり）の配列。1個〜4個含めること。
  "explanation": "なぜその選択肢が正解/不正解なのかの分かりやすい解説"
}
`;

    try {
        let response;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            const apiVersion = 'v1beta';
            const modelName = 'gemini-2.5-flash';
            response = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${state.settings.geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }]
                })
            });

            if (response.ok) break; 
            
            if (response.status === 404) {
                console.error(`Error 404: Model "${modelName}" not found at endpoint "${apiVersion}". Try checking if the model name or API version is correct for your region/project.`);
            }
            
            console.warn(`API Error (Status: ${response.status}). Retrying... (${retryCount + 1}/${maxRetries})`);
            retryCount++;
            await new Promise(r => setTimeout(r, 2000)); // リトライ間隔を少し延長
        }

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini API Error: Status ${response.status} - ${errorBody}`);
        }
        const data = await response.json();
        const candidateText = data.candidates[0].content.parts[0].text;
        const startIndex = candidateText.indexOf('{');
        const endIndex = candidateText.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1) {
            const jsonStr = candidateText.substring(startIndex, endIndex + 1);
            state.currentGeneratedData = JSON.parse(jsonStr);
        } else {
            throw new Error('JSON data not found in response: ' + candidateText);
        }
        
    } catch (error) {
        console.error('AI error:', error);
        state.currentGeneratedData = {
            question: "【エラー】問題の生成に失敗しました。元の問題をそのまま表示します：\n" + q.question,
            choices: ["正解となる選択肢", "ダミー選択肢1", "ダミー選択肢2", "ダミー選択肢3"],
            correctIndices: [0],
            explanation: q.answer || "解説データがありません。"
        };
    }

    renderQuizQuestion();
    switchView('quiz');
}

function renderQuizQuestion() {
    const genData = state.currentGeneratedData;
    
    dom.currentQNum.textContent = state.currentQuestionIndex + 1;
    dom.totalQNum.textContent = state.quizQuestions.length;

    const progressPercent = ((state.currentQuestionIndex) / state.quizQuestions.length) * 100;
    dom.quizProgress.style.width = `${progressPercent}%`;

    dom.questionText.textContent = genData.question;
    
    state.selectedChoices = new Set();
    dom.submitAnswerBtn.disabled = true;

    dom.choicesContainer.innerHTML = genData.choices.map((choice, i) => `
        <div class="choice-card" data-index="${i}">
            <div class="choice-checkbox">
                <i class='bx bx-check'></i>
            </div>
            <div class="choice-text">${choice}</div>
            <i class='bx choice-status-icon'></i>
        </div>
    `).join('');

    const choiceCards = dom.choicesContainer.querySelectorAll('.choice-card');
    choiceCards.forEach(card => {
        card.addEventListener('click', () => {
             const idx = parseInt(card.dataset.index);
             if (state.selectedChoices.has(idx)) {
                 state.selectedChoices.delete(idx);
                 card.classList.remove('selected');
             } else {
                 state.selectedChoices.add(idx);
                 card.classList.add('selected');
             }
             dom.submitAnswerBtn.disabled = state.selectedChoices.size === 0;
        });
    });
}

function submitAnswer() {
    if (state.selectedChoices.size === 0) {
        showToast('選択肢を選んでください');
        return;
    }

    const genData = state.currentGeneratedData;
    const correctSet = new Set(genData.correctIndices);
    
    let isFullyCorrect = true;
    let correctlySelected = 0;
    
    const choiceCards = dom.choicesContainer.querySelectorAll('.choice-card');
    
    choiceCards.forEach(card => {
        const idx = parseInt(card.dataset.index);
        const isSelected = state.selectedChoices.has(idx);
        const isCorrect = correctSet.has(idx);
        
        card.style.pointerEvents = 'none'; // disable clicks
        const icon = card.querySelector('.choice-status-icon');
        
        if (isSelected && isCorrect) {
            card.classList.add('correct-ans');
            icon.classList.add('bx-check-circle');
            correctlySelected++;
        } else if (isSelected && !isCorrect) {
            card.classList.add('incorrect-ans');
            icon.classList.add('bx-x-circle');
            isFullyCorrect = false;
        } else if (!isSelected && isCorrect) {
            card.classList.add('missed-ans');
            isFullyCorrect = false;
        }
    });

    const finalScore = isFullyCorrect ? 100 : Math.max(0, Math.round((correctlySelected / correctSet.size) * 100) - ((state.selectedChoices.size - correctlySelected) * 50));

    const userAnsStr = Array.from(state.selectedChoices).map(i => genData.choices[i]).join(', ');
    const correctAnsStr = genData.correctIndices.map(i => genData.choices[i]).join(', ');

    setTimeout(() => {
        showResult(userAnsStr, correctAnsStr, finalScore, genData.explanation);
    }, 1500); 
}

function showResult(userAnswer, correctAnsStr, score, feedback) {
    const q = state.quizQuestions[state.currentQuestionIndex];
    const genData = state.currentGeneratedData;

    dom.resCurrentQNum.textContent = state.currentQuestionIndex + 1;
    dom.resTotalQNum.textContent = state.quizQuestions.length;

    const progressPercent = ((state.currentQuestionIndex + 1) / state.quizQuestions.length) * 100;
    dom.quizProgress.style.width = `${progressPercent}%`;

    dom.aiScore.textContent = score;

    // 選択肢の表示
    const correctSet = new Set(genData.correctIndices);
    dom.optionsDisplay.innerHTML = genData.choices.map((choice, i) => {
        const isCorrect = correctSet.has(i);
        const icon = isCorrect ? "<i class='bx bx-check-circle' style='color: var(--success);'></i>" : "";
        const style = isCorrect ? "font-weight: bold; color: var(--text);" : "color: var(--text-muted);";
        return `<li style="margin-bottom: 4px; ${style}">${icon} ${choice}</li>`;
    }).join('');

    dom.explanationDisplay.textContent = feedback;

    state.answersContext.push({
        row: q.row,
        question: genData.question,
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

async function showNextQuestion() {
    state.currentQuestionIndex++;
    await generateAndShowQuestion();
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
            : `<button class="primary-btn" style="padding: 4px 10px; font-size: 0.8rem;" onclick="startSpecificQuiz(${q.row})"><i class='bx bx-play'></i>復習する</button>`;

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

window.startSpecificQuiz = async function (rowNum) {
    // 該当のトピックを探す
    const targetQ = state.rawQuestions.find(q => q.row === rowNum);
    if (!targetQ) return;

    // リストモーダルを閉じる
    dom.listModal.classList.remove('open');

    // クイズ対象をこの1問だけにする
    state.quizQuestions = [targetQ];
    
    // クイズを開始
    state.currentQuestionIndex = 0;
    state.answersContext = [];
    await generateAndShowQuestion();
};

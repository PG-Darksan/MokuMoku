/* MokuMoku 共通スクリプト
   - ナビゲーションのアクティブ状態
   - スクロール検知でナビにボーダー
   - 出現アニメーション (.reveal)
   - 料金トグル (月額 / 年額)
   - FAQ アコーディオン
   - 言語切替UI と 初回訪問時の自動言語検出
*/
(function () {
  'use strict';

  /* ── 言語自動検出 (root に居るときだけ動作) ──
     navigator.language を見て、 ブラウザの言語に対応するサブディレクトリへ
     リダイレクトする。 ただし以下の条件で動作:
     - localStorage に "lang_chosen" が無い (= 初回訪問のみ)
     - 現在の URL が root / または /index.html (= 日本語版)
     - 検出言語が ja 以外 (en/zh/ko/es)

     ユーザーが明示的に言語を選択 (lang-menu からクリック) したら
     localStorage に "lang_chosen" = "true" をセットして、 以降の自動切替は止める。 */
  const SUPPORTED_LANGS = ['ja', 'en', 'zh', 'ko', 'es'];
  const LANG_DIR_MAP = { ja: '', en: 'en/', zh: 'zh/', ko: 'ko/', es: 'es/' };

  function detectBrowserLang() {
    const raw = (navigator.language || navigator.userLanguage || 'ja').toLowerCase();
    // ja-JP -> ja, en-US -> en, zh-CN/zh-TW -> zh, ko-KR -> ko, es-ES/es-MX -> es
    const primary = raw.split('-')[0];
    if (SUPPORTED_LANGS.includes(primary)) return primary;
    return 'ja'; // フォールバックは日本語
  }

  function getCurrentLang() {
    // body の lang 属性 (=html の lang) または URL パスから判定
    const htmlLang = document.documentElement.lang || 'ja';
    return SUPPORTED_LANGS.includes(htmlLang) ? htmlLang : 'ja';
  }

  function shouldAutoRedirect() {
    if (localStorage.getItem('lang_chosen') === 'true') return false;
    // 既に日本語以外のサブディレクトリに居るなら自動リダイレクトしない
    const path = window.location.pathname;
    if (/\/(en|zh|ko|es)\//.test(path)) return false;
    return true;
  }

  // 自動リダイレクト実行 (root の HTML にだけ仕込む。 各HTMLは現在ページに対応する
  // 翻訳版 URL を head の link[rel=alternate] で持っているので、 それを参照する)
  if (shouldAutoRedirect()) {
    const browserLang = detectBrowserLang();
    if (browserLang !== 'ja') {
      const altLink = document.querySelector(`link[rel="alternate"][hreflang="${browserLang}"]`);
      if (altLink && altLink.href && altLink.href !== window.location.href) {
        // 1度だけリダイレクト
        localStorage.setItem('lang_chosen', 'auto');
        window.location.replace(altLink.href);
        return; // 以下のスクリプトは実行しない
      }
    }
  }

  /* ── 言語切替UIの開閉 ── */
  const langSwitcher = document.querySelector('.lang-switcher');
  if (langSwitcher) {
    const toggle = langSwitcher.querySelector('.lang-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        langSwitcher.classList.toggle('open');
      });
      // 外側クリックで閉じる
      document.addEventListener('click', (e) => {
        if (!langSwitcher.contains(e.target)) {
          langSwitcher.classList.remove('open');
        }
      });
      // 言語選択時に localStorage に記録
      langSwitcher.querySelectorAll('.lang-menu a').forEach(a => {
        a.addEventListener('click', () => {
          localStorage.setItem('lang_chosen', 'true');
        });
      });
    }
  }

  /* ── ナビアクティブ判定 ──
     <body data-page="X"> の値で現在ページを判別し、 該当する nav-link に .active を付与。
     機能サブページ (ai/video/calendar/platform) では「機能」ドロップダウン親もアクティブに。
  */
  const currentPage = document.body.dataset.page || 'home';
  const featurePages = ['features', 'ai', 'video', 'calendar', 'platform'];
  document.querySelectorAll('.nav-link').forEach(link => {
    const lp = link.dataset.page;
    let isActive = (lp === currentPage);
    if (lp === 'features' && featurePages.includes(currentPage)) isActive = true;
    link.classList.toggle('active', isActive);
  });

  /* ── スクロール検知 ── */
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  /* ── 出現アニメーション ── */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }

  /* ── 料金プラン: 月額/年額トグル ── */
  const billingButtons = document.querySelectorAll('.billing-option');
  const priceNums = document.querySelectorAll('.price-amount .num[data-monthly]');
  const annualNotes = document.querySelectorAll('.price-annual-note[data-annual-total]');
  const pricingGrid = document.querySelector('.pricing-grid');

  billingButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const billing = btn.dataset.billing;
      billingButtons.forEach(b => b.classList.toggle('active', b === btn));
      if (pricingGrid) pricingGrid.classList.toggle('billing-annual', billing === 'annual');
      priceNums.forEach(el => {
        el.textContent = billing === 'annual' ? el.dataset.annual : el.dataset.monthly;
      });
      annualNotes.forEach(el => {
        const total = el.dataset.annualTotal;
        if (billing === 'annual') {
          const numEl = el.parentElement && el.parentElement.querySelector('.num[data-monthly]');
          const monthly = numEl ? parseFloat(numEl.dataset.monthly) : 0;
          const monthlyTotal = monthly * 12;
          const saved = (monthlyTotal - parseFloat(total)).toFixed(2);
          el.textContent = '✓ 年額 $' + total + ' 一括 / 通常より $' + saved + ' お得';
        } else {
          el.innerHTML = '&nbsp;';
        }
      });
    });
  });

  /* ── FAQ アコーディオン ── */
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', () => {
      item.classList.toggle('open');
    });
  });

  /* ── 共通フォーム: ヘルパ ── */
  function showError(input, errorEl, message) {
    input.classList.add('is-error');
    errorEl.textContent = message;
  }
  function clearError(input, errorEl) {
    input.classList.remove('is-error');
    errorEl.textContent = '';
  }

  /* ── お問い合わせフォーム ── */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    const contactPanel = document.getElementById('contact-panel');
    const thanksPanel = document.getElementById('thanks-panel');
    const cnameInput = document.getElementById('cname');
    const emailInput = document.getElementById('email');
    const categoryInput = document.getElementById('category');
    const messageInput = document.getElementById('message');
    const errCname = document.getElementById('err-cname');
    const errEmail = document.getElementById('err-email');
    const errCat = document.getElementById('err-cat');
    const errMsg = document.getElementById('err-msg');

    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      let hasError = false;

      const nameValue = cnameInput.value.trim();
      if (nameValue === '') {
        showError(cnameInput, errCname, 'お名前を入力してください。');
        hasError = true;
      } else { clearError(cnameInput, errCname); }

      const emailValue = emailInput.value.trim();
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailValue === '') {
        showError(emailInput, errEmail, 'メールアドレスを入力してください。');
        hasError = true;
      } else if (!emailPattern.test(emailValue)) {
        showError(emailInput, errEmail, '正しいメールアドレスを入力してください。');
        hasError = true;
      } else { clearError(emailInput, errEmail); }

      if (categoryInput.value === '') {
        showError(categoryInput, errCat, 'お問い合わせの種類を選択してください。');
        hasError = true;
      } else { clearError(categoryInput, errCat); }

      const messageValue = messageInput.value.trim();
      if (messageValue === '') {
        showError(messageInput, errMsg, 'メッセージを入力してください。');
        hasError = true;
      } else if (messageValue.length < 10) {
        showError(messageInput, errMsg, '10 文字以上入力してください。');
        hasError = true;
      } else { clearError(messageInput, errMsg); }

      if (hasError) return;

      // Formspree に非同期送信
      // 失敗時はフォームのまま action 属性で通常 POST 送信にフォールバック
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalLabel = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '送信中…';
      }

      try {
        const formData = new FormData(contactForm);
        const response = await fetch(contactForm.action, {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          contactPanel.hidden = true;
          thanksPanel.hidden = false;
          thanksPanel.scrollIntoView({ behavior: 'smooth' });
        } else {
          // Formspree からエラーが返ってきた場合
          const data = await response.json().catch(() => null);
          const errMessage = (data && data.errors && data.errors.length > 0)
            ? data.errors.map(e => e.message).join(', ')
            : '送信に失敗しました。 時間を空けて再度お試しください。';
          showError(messageInput, errMsg, errMessage);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
          }
        }
      } catch (err) {
        // ネットワークエラーなど
        showError(messageInput, errMsg, '通信エラーが発生しました。 ネットワークをご確認ください。');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
      }
    });
  }

  /* ── ダウンロードフォーム ── */
  const dlForm = document.getElementById('dl-form');
  if (dlForm) {
    const formPanel = document.getElementById('dl-form-panel');
    const resultPanel = document.getElementById('dl-result-panel');
    const resetBtn = document.getElementById('dl-reset');
    const greeting = document.getElementById('result-greeting');
    const deptInput = document.getElementById('dl-dept');
    const dlNameInput = document.getElementById('dl-name');
    const telInput = document.getElementById('dl-tel');
    const errDept = document.getElementById('err-dept');
    const errDlName = document.getElementById('err-dl-name');
    const errTel = document.getElementById('err-tel');

    dlForm.addEventListener('submit', (event) => {
      event.preventDefault();
      let hasError = false;
      const deptValue = deptInput.value.trim();
      if (deptValue === '') { showError(deptInput, errDept, '部署名を入力してください。'); hasError = true; }
      else { clearError(deptInput, errDept); }
      const nameValue = dlNameInput.value.trim();
      if (nameValue === '') { showError(dlNameInput, errDlName, 'お名前を入力してください。'); hasError = true; }
      else { clearError(dlNameInput, errDlName); }
      const telValue = telInput.value.trim();
      if (telValue === '') { showError(telInput, errTel, '電話番号を入力してください。'); hasError = true; }
      else { clearError(telInput, errTel); }
      if (hasError) return;
      greeting.innerHTML = deptValue + ' の ' + nameValue + ' さん、有難う御座います！<br>以下のリンクからダウンロードしてください。';
      formPanel.hidden = true;
      resultPanel.hidden = false;
      resultPanel.scrollIntoView({ behavior: 'smooth' });
    });
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        dlForm.reset();
        clearError(deptInput, errDept);
        clearError(dlNameInput, errDlName);
        clearError(telInput, errTel);
        resultPanel.hidden = true;
        formPanel.hidden = false;
        formPanel.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }
})();

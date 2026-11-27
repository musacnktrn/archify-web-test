// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 · Anonymous local account recovery.
const base = 'member/account-recovery';

export async function mountAccountRecovery({host, client, state, isCurrent}) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const make = (tag, text, cls) => {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const root = make('article', '', 'email-verification account-recovery');
  const heading = make('h1', 'Hesabını kurtar');
  const notice = make('p', '', 'ev-status');
  notice.setAttribute('role', 'status');
  const pane = make('section', '', 'recovery-pane');
  root.append(heading, notice, pane);
  host.replaceChildren(root);
  let busy = false;
  function current() { return root.isConnected && isCurrent() && !doc.hidden; }
  function link(text, href = 'hesabim.html') {
    const node = make('a', text, 'text-link');
    node.href = href;
    return node;
  }
  function action(title, fn) {
    const node = make('button', title, 'ev-button');
    node.type = 'button';
    node.addEventListener('click', () => { if (current() && !busy) fn(); });
    return node;
  }
  function field(group, title, name, options) {
    const label = make('label'), input = make('input');
    Object.assign(input, {name, required:true, spellcheck:false}, options);
    input.setAttribute('autocapitalize','none');
    label.append(make('span', title), input);
    group.append(label);
    return input;
  }
  function lock(value) {
    busy = value;
    root.setAttribute('aria-busy', String(value));
    for (const el of pane.querySelectorAll('fieldset,button')) el.disabled = value;
  }
  function setStep(step, message = '', focus = true) {
    state.step = step;
    notice.textContent = message;
    render(focus);
  }
  function render(focus = false) {
    if (state.requestId && state.step === 'request') state.step = 'code';
    pane.replaceChildren();
    root.dataset.state = state.step;
    if (state.step === 'different-session') {
      pane.append(make('h2', 'Üyelik oturumun değişti'),make('p','Önceki oturumda istediğin kodun iptal edildiğini doğrulayamıyoruz. Kodun varsa süresi içinde kullanabilirsin. Kullanılmayan kod on dakika sonra sona erer.'));
      pane.append(action('Kurtarma kodum var', () => setStep('code')),action('Yeni talep aç', () => setStep('request')));
      return;
    }
    if (state.step === 'complete') {
      const title = make('h2', 'Yeni parolan hazır');
      const login = link('Yeni parolamla giriş yap');
      pane.append(title, make('p', 'Önceki oturumların kapandı. Hesabına yeni parolanla giriş yapabilirsin.'), login);
      if (focus) login.focus();
      return;
    }
    const confirm = state.step === 'code';
    const form = make('form', '', 'ev-form');
    form.dataset.action = confirm ? 'confirm' : 'request';
    const group = make('fieldset');
    group.append(make('legend', confirm ? 'Kodu kullan ve yeni parolanı seç' : 'Kurtarma kodu iste'));
    let username, email, proof, password;
    if (confirm) {
      group.append(make('p', 'Kod on dakika geçerli. En son istediğin kodu kullan.'));
      proof = field(group, '64 karakterli kurtarma kodu', 'proof', {type:'password', minLength:64, maxLength:64, pattern:'[a-f0-9]{64}', autocomplete:'one-time-code'});
      password = field(group, 'Yeni parola', 'newPassword', {type:'password', maxLength:72, autocomplete:'new-password'});
      group.append(make('small', '14–72 bayt kullan. Türkçe karakterler ve emojiler birden fazla bayt tutabilir.'));
    } else {
      group.append(make('p', 'Bu bilgisayardaki denemede daha önce doğruladığın .test adresini ve Archify kullanıcı adını gir.'));
      username = field(group, 'Archify kullanıcı adı', 'username', {type:'text', minLength:3, maxLength:64, autocomplete:'username'});
      email = field(group, 'Doğrulanmış deneme e-postası', 'email', {type:'email', maxLength:254, autocomplete:'email'});
    }
    const submit = make('button', confirm ? 'Yeni parolayı kaydet' : 'Kurtarma kodu iste', 'ev-button');
    submit.type = 'submit';
    group.append(submit); form.append(group); pane.append(form);
    if (confirm) {
      if (state.requestId) {
        pane.append(make('p', 'Yeni kod istemek için önce bu sekmede açtığın talebi iptal et. İki kod talebi arasında en az bir dakika olmalı.'));
        pane.append(action('Bu talebi iptal et', () => void cancel()));
      } else pane.append(action('Yeni kod iste', () => setStep('request')));
    } else pane.append(action('Kurtarma kodum var', () => setStep('code')));
    if (focus) form.querySelector('input')?.focus();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!current() || busy || !form.reportValidity()) return;
      if (!confirm && state.requestId) {
        setStep('code','Önce bu sekmedeki talebi tamamla veya iptal et.'); return;
      }
      let payload;
      if (confirm) {
        const size = new TextEncoder().encode(password.value).length;
        if (size < 14 || size > 72) {
          notice.textContent = 'Parola 14 ile 72 bayt arasında olmalı.';
          password.focus(); return;
        }
        payload = {proof:proof.value, newPassword:password.value};
        proof.value = ''; password.value = '';
      } else {
        const name = username.value.trim().toLowerCase(), address = email.value.trim();
        if (!/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(name) || !/\.test$/i.test(address)) {
          notice.textContent = 'Kullanıcı adını ve .test ile biten e-posta adresini kontrol et.'; return;
        }
        payload = {username:name,email:address};
      }
      const requestId = win.crypto.randomUUID();
      if (!confirm) {
        state.requestId = requestId;
        state.step = 'code';
      }
      lock(true); notice.textContent = 'Talebin işleniyor…';
      try {
        const result = await client.request(base + (confirm ? '/confirm' : '/request'), {...payload, requestId});
        if (!current()) return;
        if (confirm) {
          if (result.completed !== true || result.requiresLogin !== true) throw Error('unexpected_result');
          state.requestId = null; setStep('complete');
        } else {
          if (result.accepted !== true) throw Error('unexpected_result');
          setStep('code', 'Bilgiler doğrulanmış bir hesapla eşleşiyorsa kurtarma kodu deneme kutusuna bırakılır.');
        }
      } catch(error) {
        if (!current()) return;
        if (error.code === 'recovery_anonymous_required') return showSignedIn();
        if (error.status === 429) setStep('code', 'Deneme sınırına ulaştın. Bir süre sonra tekrar dene.');
        else if (confirm && error.status >= 400 && error.status < 500) notice.textContent = 'Kod doğrulanamadı. En son talebini ve kodun süresini kontrol et.';
        else if (confirm) {
          notice.textContent = 'İşlemin sonucu alınamadı. Yeni parolanla giriş yapmayı deneyebilirsin.';
          pane.append(link('Giriş ekranına git'));
        } else setStep('code', 'Talebin sonucu alınamadı. Deneme kutunu kontrol edebilirsin.');
      } finally { payload = null; if (current()) lock(false); }
    });
  }
  function showSignedIn() {
    const interrupted=Boolean(state.requestId)||state.step==='different-session';
    state.requestId = null; state.ownerContext = null; state.step = interrupted?'different-session':'request';
    pane.replaceChildren(make('p', 'Hesabın açık. Parolanı hesabındaki güvenlik bölümünden güncelleyebilirsin.'), link('Hesabıma git'));
    notice.textContent = interrupted?'Önceki anonim talebin iptali bu oturumdan doğrulanamadı.':'';
  }
  async function cancel() {
    if (!state.requestId) return;
    lock(true);
    try {
      const result = await client.request(base+'/cancel', {requestId:state.requestId});
      if (!current()) return;
      if (result.cancelled !== true) throw Error('unexpected_result');
      state.requestId = null; setStep('request', 'Talep iptal edildi.');
    } catch(error) {
      if (current() && error.code === 'recovery_anonymous_required') showSignedIn();
      else if (current()) notice.textContent = 'İptal işlemi doğrulanamadı. Tekrar deneyebilirsin.';
    } finally { if (current()) lock(false); }
  }
  const session = await client.request('member/session');
  if (!current()) return;
  if (session.member) showSignedIn();
  else if (!session.available) pane.append(make('p', 'Bu ortamda hesap kurtarma kapalı.'), link('Archify hesabına dön'));
  else {
    client.setCSRF(session.csrfToken);
    if (state.requestId && state.ownerContext !== session.csrfToken) {
      state.requestId = null; state.step = 'different-session';
    }
    // The opaque session context remains in this document's memory and follows the same lifetime as the CSRF client.
    state.ownerContext = session.csrfToken;
    const cap = await client.request(base);
    if (!current()) return;
    if (cap.available === true && cap.mode === 'local_fake') render();
    else pane.append(make('p', 'Bu ortamda hesap kurtarma kapalı.'), link('Archify hesabına dön'));
  }
  return () => { for (const input of root.querySelectorAll('input')) input.value = ''; root.remove(); };
}

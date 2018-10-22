// storage
const storage = {
  prefix: 'KRUMIRO-LIGHT@',
  set(k, v) {
    localStorage.setItem(storage.prefix + k, v);
  },
  get(k) {
    return localStorage.getItem(storage.prefix + k);
  },
  remove(k) {
    localStorage.removeItem(storage.prefix + k);
  }
};
// utilità
const u = {
  // cerca l'elemento per id
  i(id) { return document.getElementById(id); },
  // restituisce il totale dei minuti
  m(h, m) { return (h||0)*60+(m||0); },
  // restituisce la stringa che rappresenta l'ora
  min(m) {
    const mn = ((m || '0') + '');
    return mn.length < 2 ? '0' + mn : mn;
  },
  // costruisce un oggetto con le info dell'orario
  E(h, m, type) {
    const hr = (parseInt(h)||0);
    const mn = (parseInt(m)||0);
    const valid = !!(hr || mn);
    return {
      k: (type||'').toLowerCase(),
      h: hr,
      m: mn,
      t: u.m(hr,mn),
      v: valid ? (hr+':'+u.min(mn)) : '' };
  },
  // cerca l'input per id e aggiorna il valore se passato
  // poi restituisce il valore che contiene
  input(id, v) {
    const ele = document.getElementById(id);
    if (ele && v !== undefined) ele.value = v;
    return ele.value;
  },
  // restituisce un oggetto con le info sull'ora scritta nella stringa/numero
  time(str) {
    if (typeof(str) === 'string') {
      let m, values = [];
      const rgx = /(\d+)+/gm;
      while ((m = rgx.exec(str)) !== null) {
        if (m.index === rgx.lastIndex) rgx.lastIndex++;
        values.push(parseInt(m[1]));
      }
      return u.E(values[0], values[1]);
    } else if (typeof(str) === 'number' && str > 0) {
      const h = Math.floor(str / 60);
      const m = str - (h * 60);
      return u.E(h, m);
    } else {
      return {v:null}
    }
  },
  // restiruisce i minuti totali a partire dal contenuto
  // stringa di un input
  im(id) {
    const v = u.input(id);
    return u.time(v);
  },
  toggleClass(e, cn, active) {
    if (active) {
      if (!e.classList.contains(cn)) e.classList.add(cn);
    } else {
      if (e.classList.contains(cn)) e.classList.remove(cn);
    }
  }
 };
// opzioni predefinite
const default_options = {
  checknine: true,  //verifica l'ingresso dopo le 9:00
  checklunch: true, //verifica la pausa pranzo
  checkmine: true,  //verifica l'ingresso prima delle 8:30
  checkrange: true, //verifica l'orario giornaliero
  halfday: u.m(4),
  min_e: u.m(8,30),
  max_e: u.m(9),
  max_u: u.m(23),
  min_lunch: u.m(0,30),
  max_lunch: u.m(1,30),
  start_lunch: u.m(12,15),
  end_lunch: u.m(14,30),
  endm: u.m(22)
};


(function(w) {
  /**
   * TAIM
   */
  const lines = u.i('lines');
  const line = u.i('line-template').innerHTML;
  const dayHours = u.i('day-hours');
  const dayPerm = u.i('day-perm');
  const BODY = document.getElementsByTagName('BODY')[0];
  let _counter=0;
  const taims = {};
  const state = {};

  const settings = JSON.parse(storage.get('settings')||'{}');
  dayHours.value = settings.dayHours||'8';
  dayPerm.value = settings.dayPerm||'0';
  settings.options = settings.options||default_options;

  function _addLine() {
    _counter++;
    const line_ele = document.createElement('div');
    line_ele.innerHTML = line.replace(/-id/gm, '-'+_counter);
    lines.appendChild(line_ele);
    taims[_counter] = {e:0, u:0, d:0};
    if (!state.initialized) {
      state.initialized = true;
      u.i('e-' + _counter).focus();
    }
    return _counter;
  }

  function _clear() {
    lines.innerHTML = '';
    _counter = 0;
  }

  function _items() {
    const items = [];
    for (let i = 1; i <= _counter; i++) {
      items.push({
        e: u.im('e-' + i),
        u: u.im('u-' + i)
      });
    }
    return items;
  }

  function _isLunch(e, u) {
    return (u > 0 && e > 0 && e > settings.options.start_lunch && u < settings.options.end_lunch);
  }

  function _refresh() {
    let mP = 0, mE = 0,
      mT = u.im('day-hours').t,
      mPP = u.im('day-perm').t,
      mL = 0, m1 = 0, m2 = 0,
      firstE = 0, lastE = 0,
      lastok = false,
      lunch = false;
    // la pausa pranzo viene valutata solo se le ore di permesso non sono
    // uguali o superiori alla mezza giornata e l'opzione è attiva
    let lunchable = (mPP < settings.options.halfday) && settings.options.checklunch;
    settings.targetworkm = mT - mPP;

    _items().forEach((i) => {
      m1 = i.e.t;
      /// il minimo ingresso è alle 8:30
      if (m1 < settings.options.min_e && settings.options.checkmine) m1 = settings.options.min_e;
      /// la pausa pranzo va da un minimo di 30min ad un massimo di 90min
      if (!lunch && _isLunch(m1, m2) && settings.options.checklunch) {
        lunch = true;
        i.lunch = true;
        let p = m1 - m2;
        if (p < settings.options.min_lunch) {
          mP = settings.options.min_lunch - p;
          p = settings.options.min_lunch;
        }
        if (p > settings.options.max_lunch) {
          mP = p - settings.options.max_lunch;
          p = settings.options.max_lunch;
        }
        i.L = u.time(p).v; // U.getTime(p);
      } else i.lunch = false;
      m2 = i.u.t;
      lastok = (m2 > m1);
      // se l'intervallo è valido aggiunge le ore di lavoro
      if (lastok) {
        let l = (m2 - m1);
        i.minutes = u.time(l).v; // U.getTime(l);
        mL += l;
      } else {
        i.minutes = 0;
      }
      if (m1 > 0 && i.e.t) {
        lastE = m1;
        if (firstE === 0) {
          firstE = m1;
          // l'ingresso dopo le 9:00 va scaglionato sulle mezz'ore
          // se l'opzione è attiva
          if (firstE > settings.options.max_e && settings.options.checknine) {
            let meT = firstE - settings.options.max_e;
            let meM = Math.floor(meT / 30);
            if (meM * 30 < meT) meM++;
            mE = meM * 30 - meT;
          }
        }
        if (m2 > 0) lastE = m2
      }
    });

    if (!lunch && lunchable) mP = settings.options.min_lunch;
    let r = lastE + mT - mL + mP - mPP + mE;
    if (r <= settings.options.min_e || r >= settings.options.max_u) r = 0;

    state.startm = firstE;
    state.exitm = r;
    state.exit = (r > 0) ? u.time(r).v : '?';

    settings.dayHours = u.input('day-hours');
    settings.dayPerm = u.input('day-perm');
    storage.set('settings', JSON.stringify(settings));
    u.i('exit-time').innerHTML = state.exit;
  }

  function _checkTime() {
    const now = new Date();
    const n = u.E(now.getHours(), now.getMinutes());
    const elapsedm = state.exitm - n.t;
    const e = u.time(elapsedm);
    u.i('exit-elapsed').innerHTML = e.v;
    state.getout = state.exitm > default_options.min_e && elapsedm <= 0;
    u.toggleClass(BODY, 'get-out', state.getout);
  }

  function _focus(id, type) {
    setTimeout(() => {
      const next = (type === 'e') ? u.i('u-' + id) : u.i('e-' + (id + 1));
      if (next) next.focus();
    }, 250);
  }

  function _check(id, type) {
    if (type === 'u') {
      const next = u.i('e-' + (id + 1));
      if (!next) _addLine();
    }
  }

  function _insert(rows) {
    if (!rows || rows.length<=0) return;
    _clear();
    let id = _addLine();
    let state = {};
    rows.forEach((r) => {
      if (state[r.k]) {
        id = _addLine();
        state = {};
      }
      state[r.k] = r.v;
      u.input(r.k + '-' + id, r.v);
    });
  }

  function _parse(str) {
    str = str||'';
    let m, values = [];
    const rgx = /(\d+\/\d+\/\d+).*?(\d+).*?(\d+).*?(\w+)/gmi;
    while ((m = rgx.exec(str)) !== null) {
      if (m.index === rgx.lastIndex) rgx.lastIndex++;
      values.push(m);
    }
    if (values.length>0) {
      // sceglie il giorno da considerare
      const day = values[0][1];
      const rows = [];
      values.forEach((v) => (v[1] === day) ? rows.push(u.E(v[2], v[3], v[4])) : null);
      rows.sort((v1,v2) => v1.t - v2.t);
      _insert(rows);
    }
  }

  w.calc = function(e) {
    const value = e.target.value;
    const type = e.target.id[0];
    const index = parseInt(e.target.id.substr(2));
    const tm = u.time(value);
    if (index>0) taims[index][type] = tm.t;
    e.target.value = tm.v;
    _check(index, type);
    _refresh();
    _focus(index, type);
  };

  w.addEventListener('paste', function(e){
    e = e || event;
    e.preventDefault();
    const txt = e.clipboardData.getData('Text');
    _parse(txt);
    _refresh();
  }, false);

  setInterval(() => _checkTime(), 1000);

  _addLine();
})(this);
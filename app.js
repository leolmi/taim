'use strict';

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
  isDate(date) {
    return Object.prototype.toString.call(date) === '[object Date]'
  },
  isObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]'
  },
  isNaN(v) {
    return v==='NaN' || (typeof(v)==='number' && isNaN(v));
  },
  // costruisce un oggetto con le info dell'orario
  E(h, m, type) {
    if (u.isDate(h)) {
      m = h.getMinutes();
      h = h.getHours();
    }
    const hr = (parseInt(h)||0);
    const mn = (parseInt(m)||0);
    const valid = !!(hr || mn);
    return {
      k: (type||'').toLowerCase(),
      h: hr,
      m: mn,
      t: u.m(hr,mn),
      v: valid ? (hr+':'+u.min(mn)) : ''
    };
  },
  // cerca l'input per id e aggiorna il valore se passato
  // poi restituisce il valore che contiene
  input(id, v) {
    const ele = document.getElementById(id);
    if (ele && v !== undefined) ele.value = v;
    return ele.value;
  },
  now() {
    const now = new Date();
    return u.E(now.getHours(), now.getMinutes());
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
  im(id, kind) {
    const v = u.input(id);
    const t = u.time(v);
    t.k = kind||'';
    return t;
  },
  toggleClass(e, cn, active) {
    if (active) {
      if (!e.classList.contains(cn)) e.classList.add(cn);
    } else {
      if (e.classList.contains(cn)) e.classList.remove(cn);
    }
  },
  set(id, an, av) {
    const e = u.i(id);
    if (!e) return;
    if (u.isNaN(av)) av = 0;
    typeof(av) === 'undefined' ? e.innerHTML = an : e.setAttribute(an, av);
  },
  format(str, o) {
    for(let pn in o) {
      const rgx = new RegExp('\\{'+pn+'\\}', 'gmi');
      str = str.replace(rgx, o[pn]);
    }
    return str;
  },
  rad(CX, CY, r, a) {
    const rdn = (a - 90) * Math.PI / 180.0;
    return {
      x: CX + (r * Math.cos(rdn)),
      y: CY + (r * Math.sin(rdn))
    };
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
  // const grid = u.i('grid-lines');
  const klok = u.i('svg-klok');
  const BODY = document.getElementsByTagName('BODY')[0];
  // const line_template = '<line x1="{x}" y1="90" x2="{x}" y2="100" stroke="#222" stroke-width="4" />';
  const klok_item = '<path d="{d}" fill="none" stroke="yellowgreen" stroke-width="60"></path>';
  let _counter=0;
  const taims = {};
  const state = {
    nowtime: true,
    lunch: {},
    lock: false
  };
  const klok_layout = {
    main: 'klok',
    center: {
      x: 300,
      y: 300
    },
    radius: 200
  };

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
        e: u.im('e-' + i, 'e'),
        u: u.im('u-' + i, 'u')
      });
    }
    return items;
  }

  function _isLunch(e, u) {
    return (u > 0 && e > 0 && e > settings.options.start_lunch && u < settings.options.end_lunch);
  }

  function _isInLunch(m) {
    return (m > 0 && m >= settings.options.start_lunch && m < settings.options.end_lunch);
  }

  function _refresh() {
    let mP = 0, mE = 0,
      mT = u.im('day-hours').t,
      mPP = u.im('day-perm').t,
      mL = 0, m1 = 0, m2 = 0,
      firstE = 0, lastE = 0,
      lastok = false,
      lunch = false;
    const nowm = u.now().t;
    state.lunch = {};
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
        let p = m1 - m2;
        if (p < settings.options.min_lunch) {
          mP = settings.options.min_lunch - p;
          p = settings.options.min_lunch;
        }
        if (p > settings.options.max_lunch) {
          mP = p - settings.options.max_lunch;
          p = settings.options.max_lunch;
        }
        const lt = u.time(p);
        i.L = lt.v;
        state.lunch.startm = m2;
        state.lunch.endm = m1||nowm;
      } else if (!lunch && !i.e.t && _isInLunch(m2)) {
        state.lunch.startm = m2;
        state.lunch.endm = nowm;
      }
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
    // u.i('exit-time').innerHTML = state.exit;
  }

  function _checkTime() {
    state.now = u.now();
    state.nowv = state.now.v;
    const elapsedm = state.exitm - state.now.t;
    state.getout = state.exitm > default_options.min_e && elapsedm <= 0;
    // u.toggleClass(BODY, 'get-out', state.getout && !state.lock);
    u.toggleClass(klok, 'active', state.getout && !state.lock);
    // _graph(n);
    _graph();
  }

  function _text(info) {
    u.set('maintime', info.exit||'');
    u.set('worktime', info.work||'');
    u.set('pausetime', info.pause||'');
    u.set('giftwtime', info.gift.w||'');
    u.set('giftptime', info.gift.p||'');
    _current();
  }

  function _current() {
    const m = state.nowtime ? state.now.v :  Math.abs(state.exitm - state.now.t);
    u.set('currenttime', u.time(m).v);
  }

  function _d(startAngle, endAngle) {
    if (u.isObject(startAngle)) {
      endAngle = startAngle.end - 1;
      startAngle = startAngle.start;
    }
    if (endAngle > 360) endAngle = 360;
    if (startAngle >= endAngle) return null;
    const start = u.rad(klok_layout.center.x, klok_layout.center.y, klok_layout.radius, endAngle);
    const end = u.rad(klok_layout.center.x, klok_layout.center.y, klok_layout.radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      'M', start.x, start.y,
      'A', klok_layout.radius.toFixed(2), klok_layout.radius.toFixed(2), 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  }

  function _arc(name, startAngle, endAngle){
    if (!name) {
      name = klok_layout.main;
      startAngle = 0;
      endAngle = 359.99;
    }
    const d = _d(startAngle, endAngle);
    u.set(name, 'd', d);
  }

  function _graph() {
    const info = {
      nowm: state.now.t,
      workm: 0,
      exitm: state.exitm,
      exit: state.exit,
      gift: {},
      items: [],
      tot: 0,
      over: {},   // over time
      out: {},    // out of time
      angle(v) { return ((v - info.str) * 360) / (info.tot || 1); }
    };
    let pre;
    _items().forEach((i) => {
      if (i.e.t>0) {
        if (!info.start) info.start = i.e.t;
        const item = {};
        item.EM = pre && pre.UM > i.e.t ? pre.UM + 10 : i.e.t;
        item.UM = i.u.t > item.EM ? i.u.t : 0;
        item.dt = item.UM > item.EM ? item.UM - item.EM : 0;
        if (pre && item.dt <= 0) item.dt = pre.EM - 1 - item.EM;
        info.items.push(item);
        pre = item;
      }
    });
    const first = info.items[0];
    const last = info.items[info.items.length>0?info.items.length-1:0];
    info.closed = !!last.UM;
    if (!info.closed) {
      last.UM = info.nowm >= last.EM ? info.nowm : last.EM + 10;
      last.dt = last.UM - last.EM;
    }
    info.str = first.EM;
    info.tot = info.exitm - first.EM;
    info.items.forEach(function (i) {
      i.start = info.angle(i.EM);
      i.end = info.angle(i.UM);
      i.d = _d(i);
      info.workm += i.UM - i.EM;
    });
    info.work = u.time(info.workm).v;
    info.done = info.closed && ((info.workm >= settings.targetworkm) || (settings.options.checkrange && info.nowm >= settings.options.max_u));
    const now_angle = info.angle(info.nowm);
    const end = info.done ? last.end : Math.max(last.end||0, now_angle);
    // over tempo passato (tutto)
    info.d = _d(first.start + 1, end - 1);
    // over (tempo non passato)
    if (last.UM > info.nowm) {
      info.over.start = now_angle;
      info.over.end = info.angle(last.UM);
      info.over.d = _d(info.over);
    }
    // out (tempo oltre il limite)
    // const max = Math.max(info.nowm, last.UM);
    // if ((max > info.exitm) && !info.done) {
    if (!info.done && (info.nowm > info.exitm)) {
      info.out.start = info.angle(info.start);
      info.out.end = info.angle(info.start + info.nowm - info.exitm);
      info.out.d = _d(info.out);
      info.gift.wm = (info.nowm - info.exitm);
    } else if (info.done && (last.UM > info.exitm)) {
      info.out.start = info.angle(info.start);
      info.out.end = info.angle(info.start + last.UM - info.exitm);
      info.out.d = _d(info.out);
      info.gift.wm = (last.UM - info.exitm);
    }
    let p = 0;
    if (info.done) {
      p = last.UM - info.start - info.workm;
    } else if (info.nowm - info.start > info.workm) {
      p = info.nowm - info.workm - info.start;
    }
    info.pause = u.time(p).v;
    // se la pausa è durata meno di 30 min
    // mostra il delta non usufruito
    if (settings.options.checklunch && p > 0 && p < 30 && info.items.length>1) {
      info.outp = {
        start: info.angle(last.EM),
        end: info.angle(last.EM + 30 - p)
      };
      info.outp.d = _d(info.outp);
      info.gift.pm = (30 - p);
    }
    info.gift.w = u.time(info.gift.wm).v;
    info.gift.p = u.time(info.gift.pm).v;
    //console.log('KLOK', info);
    u.i('klok-items').innerHTML = info.items.map((i) => u.format(klok_item, {d:i.d})).join('\n');

    u.set('klok-d', 'd', info.d);
    u.set('klok-over-d', 'd', info.over.d||'');
    u.set('klok-out-d', 'd', (info.out||{}).d||'');
    u.set('klok-outp-d', 'd', (info.outp||{}).d||'');

    _arc();
    _text(info);
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
    str = str.replace(/[\r\n]/g, ' ');
    let m, values = [];
    const rgx = {
      tx:/(\d{2}\/\d{2}\/\d{4}).*?(\d{1,2}).*?(\d{1,2}).*?([EU])/g,
      x: /(\d{2}\/\d{2}\/\d{4}).*?(\d{1,2}).*?(\d{1,2}).*?([EU])/g,
      o: {data:1, h:2, m:3, k:4} };
    if (!rgx.tx.test(str)) return console.warn('Unrecognized text!', str);
    while ((m = rgx.x.exec(str)) !== null) {
      if (m.index === rgx.x.lastIndex) rgx.x.lastIndex++;
      values.push(m);
    }
    if (values.length>0) {
      // sceglie il giorno da considerare
      const day = values[0][rgx.o.data];
      const rows = [];
      values.forEach((v) => (v[rgx.o.data] === day) ? rows.push(u.E(v[rgx.o.h], v[rgx.o.m], v[rgx.o.k])) : null);
      rows.sort((v1,v2) => v1.t - v2.t);
      _insert(rows);
    }
  }

  w.clickKlok = function() {
    console.log('CLICK CLOK!');
  };

  w.toggleNow = function() {
    state.nowtime = !state.nowtime;
    _current();
  };

  w.calc = function(e) {
    state.lock = false;
    const value = e.target.value;
    const type = e.target.id[0];
    const index = parseInt(e.target.id.substr(2));
    const tm = u.time(value);
    if (index>0) taims[index][type] = tm.t;
    e.target.value = tm.v;
    _check(index, type);
    _refresh();
    _focus(index, type);
    _checkTime();
  };

  w.addEventListener('paste', function(e){
    e = e || event;
    e.preventDefault();
    const txt = e.clipboardData.getData('Text');
    _parse(txt);
    _refresh();
  }, false);

  w.addEventListener('click', function(e){
    if (state.getout) {
      state.lock = true;
      _checkTime();
    }
  }, false);

  setInterval(() => _checkTime(), 30000);

  _addLine();
})(this);
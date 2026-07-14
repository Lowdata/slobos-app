"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '@/components/Modal';
import { createSoundManager } from '@/lib/sounds';
import { BrowserProvider } from 'ethers';

const CONFIG = {
  ODDS: { red: 0.45, black: 0.45, green: 0.10 },
  REWARDS: {
    red: { label: '— Nothing —', tickets: 0 },
    black: { label: '+1 Raffle Ticket', tickets: 1 },
    green: { label: 'GTD Whitelist Spot', tickets: 0 },
  }
};

const PFPS = ['/assets/pfp-pow-sm.png', '/assets/pfp-hat-sm.png', '/assets/pfp-melt-sm.jpg'];

const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);
const easeOutQuart = (u) => 1 - Math.pow(1 - u, 4);

export default function Home() {
  // ===== State =====
  const [state, setState] = useState({
    connected: false,
    wallet: null,
    twitter: null,
    refCode: null,
    referredBy: null,
    spinsAvailable: 0,
    tickets: 0,
    wonWL: false,
    streak: 0,
    referrals: 0,
    history: [],
  });

  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [selectedColor, setSelectedColor] = useState('red');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('default'); // 'default' | 'success'
  const [soundMuted, setSoundMuted] = useState(false);

  // Modals
  const [showConnect, setShowConnect] = useState(false);
  const [connectStep, setConnectStep] = useState(1); // 1=wallet, 2=username, 3=twitter
  const [showResult, setShowResult] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const [resultData, setResultData] = useState({ result: 'red', label: '' });

  // Inputs
  const [usernameInput, setUsernameInput] = useState('');
  const [twitterInput, setTwitterInput] = useState('');
  const [connectedWallet, setConnectedWallet] = useState(null);

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState({}); // taskId -> countdown seconds

  // Animation refs
  const wheelRef = useRef(null);
  const ballRef = useRef(null);
  const wheelStageRef = useRef(null);
  const rafId = useRef(null);
  const wheelRot = useRef(0);
  const ballAngle = useRef(0);
  const ballR = useRef(0.42);
  const [flash, setFlash] = useState(null);

  // Sound
  const soundRef = useRef(null);

  // ===== Wheel constants =====
  const POCKETS = 30;
  const POCKET_DEG = 360 / POCKETS;
  const POCKET_COLORS = Array.from({ length: POCKETS }, (_, i) => {
    if (i === 0 || i === POCKETS / 2) return 'green';
    return i % 2 ? 'red' : 'black';
  });
  const POCKET_FILL = { green: '#00c805', red: '#d92c2c', black: '#15171a' };

  // ===== Init =====
  useEffect(() => {
    soundRef.current = createSoundManager();

    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      setState(s => ({ ...s, referredBy: ref }));
    }

    const savedWallet = localStorage.getItem('slobos_wallet');
    if (savedWallet) {
      fetchUserData(savedWallet);
    } else {
      setLoading(false);
      // Auto-show connect modal if not logged in
      setTimeout(() => setShowConnect(true), 600);
    }
  }, []);

  useEffect(() => {
    paintWheel();
    renderWheel();
    const handleResize = () => renderWheel();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ===== Helpers =====
  const toast = (msg, type = 'default') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 3200);
  };

  const refLink = () => {
    if (typeof window !== 'undefined' && state.refCode) {
      return `${window.location.origin}?ref=${state.refCode}`;
    }
    return '';
  };

  // ===== Data fetching =====
  const fetchUserData = async (wallet) => {
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet, username: 'returning' })
      });
      const data = await res.json();
      if (data && data.walletAddress) {
        setState(s => ({
          ...s,
          connected: true,
          wallet: data.walletAddress,
          twitter: data.twitter || data.username,
          refCode: data.referralCode,
          spinsAvailable: data.spinsAvailable,
          tickets: data.tickets,
          wonWL: data.wonWL,
          streak: data.streak,
          referrals: data.referrals,
        }));
        localStorage.setItem('slobos_wallet', data.walletAddress);
        fetchTasks(data.walletAddress);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchTasks = async (wallet) => {
    try {
      const res = await fetch(`/api/tasks?wallet=${wallet}`);
      const data = await res.json();
      if (data.tasks && data.tasks.length > 0) {
        setTasks(data.tasks);
      }
      setCompletedTasks(data.completed || []);
    } catch (e) { console.error(e); }
  };

  // ===== Stepwise connect flow =====
  const handleConnectWallet = async () => {
    if (!window.ethereum) {
      toast('MetaMask not found. Please install it.');
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const address = accounts[0];
      setConnectedWallet(address);

      // Check if this wallet already has an account
      const checkRes = await fetch(`/api/user?wallet=${address}`);
      const checkData = await checkRes.json();
      if (checkData.exists && checkData.user) {
        // Existing user — log them in directly
        localStorage.setItem('slobos_wallet', address);
        await fetchUserData(address);
        setShowConnect(false);
        setConnectStep(1);
        toast('Welcome back! 🎰');
        return;
      }

      setConnectStep(2); // new user — proceed to username
    } catch (e) {
      console.error(e);
      toast('Wallet connection failed');
    }
  };

  const handleSubmitUsername = async () => {
    const name = usernameInput.trim();
    if (!name) {
      toast('Please enter a username');
      return;
    }
    // Check if username is taken
    try {
      const res = await fetch(`/api/user?checkUsername=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.taken) {
        toast('Username already taken. Try another one.');
        return;
      }
    } catch (e) {
      console.error(e);
    }
    setConnectStep(3); // move to twitter step
  };

  const handleSubmitTwitter = async () => {
    if (!twitterInput.trim()) {
      toast('Please enter your Twitter handle');
      return;
    }

    const handle = twitterInput.trim().replace(/^@?/, '@');

    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: connectedWallet,
          username: usernameInput.trim(),
          twitter: handle,
          referredBy: state.referredBy,
        })
      });
      const data = await res.json();

      if (data.walletAddress) {
        localStorage.setItem('slobos_wallet', data.walletAddress);
        await fetchUserData(data.walletAddress);
        setShowConnect(false);
        setConnectStep(1);
        toast('🎰 Welcome to SLOBOS! Complete tasks to earn spins.');
      }
    } catch (e) {
      console.error(e);
      toast('Registration failed');
    }
  };

  const startTaskVerification = (taskId, actionLink) => {
    if (pendingTasks[taskId] || completedTasks.includes(taskId)) return;
    if (actionLink) window.open(actionLink, '_blank');
    setPendingTasks(prev => ({ ...prev, [taskId]: true }));
    setTimeout(() => {
      completeTaskAPI(taskId);
      setPendingTasks(prev => {
        const { [taskId]: _, ...rest } = prev;
        return rest;
      });
    }, 10000);
  };

  const completeTaskAPI = async (taskId) => {
    if (!state.wallet) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: state.wallet, taskId })
      });
      const data = await res.json();
      if (data.success) {
        toast(`🎉 Task completed! +${data.rewardSpins} spins earned`, 'success');
        setCompletedTasks(prev => [...prev, taskId]);
        setState(s => ({ ...s, spinsAvailable: data.user.spinsAvailable }));
      } else {
        toast(data.error || 'Task error');
      }
    } catch (e) {
      toast('Task error');
    }
  };

  // ===== Wheel painting & animation =====
  const paintWheel = () => {
    if (!wheelRef.current) return;
    const stops = POCKET_COLORS
      .map((c, i) => `${POCKET_FILL[c]} ${i * POCKET_DEG}deg ${(i + 1) * POCKET_DEG}deg`)
      .join(', ');
    const half = POCKET_DEG / 2;
    wheelRef.current.style.background =
      `repeating-conic-gradient(from ${-half - 0.3}deg, rgba(255,255,255,.18) 0deg 0.6deg, transparent 0.6deg ${POCKET_DEG}deg), ` +
      `conic-gradient(from ${-half}deg, ${stops})`;
  };

  const renderWheel = useCallback(() => {
    if (!wheelRef.current || !ballRef.current || !wheelStageRef.current) return;
    wheelRef.current.style.transform = `rotate(${wheelRot.current}deg)`;
    // Ball radius is relative to the wheel-stage container (half its width)
    const R = wheelStageRef.current.clientWidth / 2;
    ballRef.current.style.transform =
      `translate(-50%,-50%) rotate(${ballAngle.current}deg) translateY(${(-ballR.current * R).toFixed(2)}px)`;
  }, []);

  const animateWheel = (result) => {
    const T = 4600;
    const pOf = (color) => POCKET_COLORS.flatMap((c, i) => (c === color ? [i] : []));
    const pList = pOf(result);
    const pocket = pList[Math.floor(Math.random() * pList.length)];
    const pocketOff = pocket * POCKET_DEG;

    const base = wheelRot.current + 4 * 360;
    const endRot = base + ((((-pocketOff - base) % 360) + 360) % 360);
    const W0 = wheelRot.current;
    const DW = endRot - W0;
    const W = (t) => W0 + DW * easeOutCubic(t / T);

    const tCatch = 0.78 * T;
    const tDrop = 0.55 * T;
    const catchTarget = W(tCatch) + pocketOff;
    const B0 = ballAngle.current;
    const D = (((B0 - catchTarget) % 360) + 360) % 360 + 3 * 360;
    const B = (t) => B0 - D * easeOutQuart(Math.min(t / tCatch, 1));

    // Ball radii — keep inside wheel bounds (0.42 = inner track, 0.36 = pocket)
    const R_TRACK = 0.42;
    const R_POCKET = 0.36;

    // Start spin sound
    soundRef.current?.startSpin();

    return new Promise((resolve) => {
      cancelAnimationFrame(rafId.current);
      const t0 = performance.now();
      const frame = (now) => {
        const t = Math.min(now - t0, T);
        wheelRot.current = W(t);

        if (t < tCatch) {
          ballAngle.current = B(t);
          ballR.current = t < tDrop
            ? R_TRACK
            : R_TRACK + (R_POCKET - R_TRACK) * easeOutCubic((t - tDrop) / (tCatch - tDrop));
        } else {
          const s = (t - tCatch) / (T - tCatch);
          ballAngle.current = W(t) + pocketOff;
          ballR.current = R_POCKET + Math.sin(s * Math.PI * 3) * (1 - s) * 0.015;
        }

        renderWheel();
        if (t < T) { rafId.current = requestAnimationFrame(frame); }
        else {
          ballAngle.current = wheelRot.current + pocketOff;
          ballR.current = R_POCKET;
          renderWheel();
          soundRef.current?.stopSpin();
          resolve();
        }
      };
      rafId.current = requestAnimationFrame(frame);
    });
  };

  // ===== Spin logic =====
  const doSpin = async () => {
    if (spinning || state.spinsAvailable <= 0 || !state.connected) return;
    setSpinning(true);

    try {
      const res = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: state.wallet })
      });
      const data = await res.json();

      if (data.error) {
        toast(data.error);
        setSpinning(false);
        return;
      }

      setState(s => ({ ...s, spinsAvailable: s.spinsAvailable - 1 }));

      await animateWheel(data.result);

      // Determine label
      let label = CONFIG.REWARDS[data.result].label;
      if (data.result === 'green') {
        label = data.ticketsWon > 0 ? `+${data.ticketsWon} Raffle Tickets` : 'GTD Whitelist Spot 🎉';
      } else if (data.result === 'black') {
        label = '+1 Raffle Ticket';
      }

      // Play result sound
      if (data.result === 'red') {
        soundRef.current?.lose();
      } else {
        soundRef.current?.win();
      }

      setState(s => ({
        ...s,
        history: [...s.history, data.result],
        tickets: data.user.tickets,
        wonWL: data.user.wonWL
      }));

      setResultData({ result: data.result, label });

      const flashText = data.result === 'green' ? (label.includes('Whitelist') ? 'WL SECURED' : `+${data.ticketsWon} TICKETS`)
        : data.result === 'black' ? '+1 TICKET' : 'REKT';
      setFlash({
        text: flashText,
        color: data.result === 'green' ? 'var(--mint)' : data.result === 'black' ? 'var(--gold)' : 'var(--red)'
      });
      setTimeout(() => setFlash(null), 1800);

      setShowResult(true);
    } catch (e) {
      toast('Spin failed');
    }

    setSpinning(false);
  };

  const shareToTwitter = (text) => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  // ===== Render =====
  return (
    <>
      {/* SVG defs */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id="headFill" cx="42%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#41302a"/>
            <stop offset="70%" stopColor="#241812"/>
            <stop offset="100%" stopColor="#150d08"/>
          </radialGradient>
          <linearGradient id="crownFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f4d580"/>
            <stop offset="55%" stopColor="#d9a441"/>
            <stop offset="100%" stopColor="#a06a1e"/>
          </linearGradient>
          <linearGradient id="maskFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2c862"/>
            <stop offset="100%" stopColor="#d99f35"/>
          </linearGradient>
          <symbol id="sloboHead" viewBox="0 0 220 240">
            <polygon fill="url(#headFill)" stroke="rgba(198,232,0,.32)" strokeWidth="2.5" points="110.0,33.6 123.2,52.4 142.8,38.1 149.0,59.2 167.2,58.6 171.3,74.2 194.0,76.9 182.4,97.5 203.6,106.7 186.0,122.0 204.5,137.5 183.3,146.8 187.1,163.4 171.3,169.8 172.4,191.1 148.5,184.0 142.5,205.0 123.2,191.6 110.0,211.3 96.5,193.4 79.6,199.8 70.0,186.4 47.6,191.1 51.0,168.0 27.7,166.2 38.6,146.2 15.5,137.5 32.0,122.0 22.4,107.6 34.8,96.6 26.0,76.9 51.0,76.0 48.9,54.3 72.0,60.8 77.2,38.1 96.5,50.6"/>
            <g transform="rotate(-7 110 46)">
              <path d="M58 62 L64 18 L84 40 L98 6 L113 36 L130 4 L143 38 L157 16 L164 60 Q110 74 58 62 Z" fill="url(#crownFill)" stroke="#7a5215" strokeWidth="2"/>
              <path d="M104 41 c-3 -6 -12 -4 -12 3 c0 5 8 9 12 12 c4 -3 12 -7 12 -12 c0 -7 -9 -9 -12 -3 Z" fill="#e8262d"/>
            </g>
            <circle cx="42" cy="152" r="10" fill="#050302"/>
            <g transform="rotate(6 40 130)">
              <polygon points="6,124 58,112 60,136" fill="#e07820"/>
              <rect x="44" y="112" width="9" height="25" fill="#b03d1e" transform="rotate(-4 48 124)"/>
            </g>
            <g transform="rotate(-5 110 116)">
              <rect x="28" y="84" width="168" height="64" rx="10" fill="url(#maskFill)" stroke="#8a5c17" strokeWidth="2.5"/>
              <circle cx="78" cy="116" r="24" fill="#000"/>
              <circle cx="150" cy="115" r="25" fill="#000"/>
              <ellipse cx="70" cy="112" rx="7" ry="11" fill="#fff" transform="rotate(-12 70 112)"/>
              <ellipse cx="142" cy="110" rx="7" ry="12" fill="#fff" transform="rotate(-10 142 110)"/>
            </g>
            <path d="M66 164 Q118 150 172 166 Q178 204 120 210 Q68 202 66 164 Z" fill="#050302"/>
          </symbol>
          <symbol id="sloboPaw" viewBox="0 0 70 40">
            <path d="M4 40 Q2 16 14 12 Q18 2 26 10 Q34 0 42 9 Q50 2 55 12 Q68 16 66 40 Z" fill="#1d130c" stroke="rgba(198,232,0,.3)" strokeWidth="1.5"/>
          </symbol>
          <symbol id="rhFeather" viewBox="0 0 24 24">
            <path d="M20 4C10 5 5 11 5 19l2-2c1-6 5-9 13-10z" fill="currentColor"/>
            <path d="M5 19c0-8 5-14 15-15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
          </symbol>
          <symbol id="icoShare" viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/>
            <path d="M8.3 10.7 15.7 6.4 M8.3 13.3 15.7 17.6" stroke="currentColor" strokeWidth="1.8" fill="none"/>
          </symbol>
          <symbol id="icoTrophy" viewBox="0 0 24 24">
            <path d="M7 3h10v5a5 5 0 0 1-10 0V3Z M7 4H4v2a3 3 0 0 0 3 3 M17 4h3v2a3 3 0 0 1-3 3" fill="none" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M10 13h4v4h-4z M8 19h8v2H8z" fill="currentColor"/>
          </symbol>
          <symbol id="betDiamond" viewBox="0 0 120 120">
            <g shapeRendering="crispEdges">
              <path fillRule="evenodd" style={{fill: 'var(--band,#333)'}} d="M60 8 L112 60 L60 112 L8 60 Z M60 32 L88 60 L60 88 L32 60 Z"/>
              <path fill="none" strokeWidth="3" strokeDasharray="5 4" style={{stroke: 'var(--stitch,#ddd)'}} d="M60 8 L112 60 L60 112 L8 60 Z"/>
              <path fill="none" strokeWidth="3" strokeDasharray="5 4" style={{stroke: 'var(--stitch,#ddd)'}} d="M60 32 L88 60 L60 88 L32 60 Z"/>
            </g>
          </symbol>
        </defs>
      </svg>

      {/* ===== Top bar ===== */}
      <header className="topbar">
        <div className="tb-side">
          <button className="logo-box" title="SLOBOS" aria-label="SLOBOS home">
            <svg className="logo-mini"><use href="#sloboHead"/></svg>
          </button>
        </div>
        <div className="tb-center">
          <svg className="logo-mark" aria-hidden="true"><use href="#sloboHead"/></svg>
          <span className="brand-name">slobos</span>
        </div>
        <div className="tb-side tb-right">
          {/* Leaderboard — disabled, coming soon */}
          <button className="gh-btn disabled-trophy" title="Leaderboard — Coming Soon" disabled>
            <svg className="gh-ico"><use href="#icoTrophy"/></svg>
          </button>
          {!state.connected && <button className="login-link" onClick={() => { setConnectStep(1); setShowConnect(true); }}>LOGIN</button>}
          <button className={`signup-btn ${state.connected ? 'connected' : ''}`} onClick={() => state.connected ? setShowAccount(true) : (setConnectStep(1), setShowConnect(true))}>
            {state.connected ? state.twitter : 'SIGNUP'}
          </button>
        </div>
      </header>

      {/* ===== Page ===== */}
      <div className="page">
        {/* Game head row */}
        <div className="game-head">
          <div className="gh-left">
            <span className="gh-cross">✛</span>
            <span className="gh-title">ROULETTE</span>
            <button className="gh-btn sound-btn" title={soundMuted ? 'Unmute' : 'Mute'} onClick={() => {
              const m = soundRef.current?.toggle();
              setSoundMuted(m);
            }}>
              {soundMuted ? '🔇' : '🔊'}
            </button>
          </div>
          <div className="gh-right">
            <button className="gh-btn" title="Share" onClick={() => {
              if (!state.connected) { setConnectStep(1); setShowConnect(true); }
              else shareToTwitter(`Spinning the @SLOBOS wheel for a GTD whitelist spot 👇\n${refLink()}`);
            }}>
              <svg className="gh-ico" fill="currentColor"><use href="#icoShare"/></svg>
            </button>
            <span className="vr"></span>
            <button className="gh-btn" title="How it works" onClick={() => setShowInfo(true)}>ⓘ</button>
          </div>
        </div>

        {/* ===== Main game ===== */}
        <main className="stage">
          {/* Left panel */}
          <section className="panel">
            <div className="bet-cards">
              {['red', 'black', 'green'].map(color => (
                <button key={color} className={`bet-card ${color} ${selectedColor === color ? 'selected' : ''}`} onClick={() => setSelectedColor(color)}>
                  <span className="diamond-wrap">
                    <svg className="diamond" aria-hidden="true"><use href="#betDiamond"/></svg>
                    <span className="bc-name">{color.toUpperCase()}</span>
                  </span>
                  <span className="bc-payout">
                    {color === 'red' ? 'Nothing · 45%' : color === 'black' ? '+1 Ticket · 45%' : 'GTD WL · ~8%'}
                  </span>
                </button>
              ))}
            </div>

            <div className="field-head">
              <span>Spins</span>
              <span className="available">Available: <b>{state.spinsAvailable}</b></span>
            </div>
            <div className="amount-row">
              <span className="coin">◈</span>
              <span className="amount-val">1 <em>spin</em></span>
              <span className="amount-btns">
                <button className="q-btn" onClick={() => { if (!state.connected) { setConnectStep(1); setShowConnect(true); } else setShowTasks(true); }}>TASKS</button>
              </span>
            </div>

            <div className="stats">
              <div className="stat-row"><span>Win Chance:</span><b>{(CONFIG.ODDS[selectedColor] * 100).toFixed(2)}%</b></div>
              <div className="stat-row"><span>Reward:</span><b>{CONFIG.REWARDS[selectedColor].label}</b></div>
              <div className="stat-row"><span>Whitelist:</span><b className={state.wonWL ? 'won' : ''} id="wlPill">{state.wonWL ? 'SECURED ✓' : 'not yet'}</b></div>
              <div className="stat-row">
                <span>Streak: <b>{state.streak}</b>d</span>
                <span className="streak-track">
                  {Array.from({length: 7}).map((_, i) => (
                    <i key={i} className={i < state.streak % 7 || (state.streak >= 7 && state.streak % 7 === 0) ? 'on' : ''}></i>
                  ))}
                </span>
              </div>
            </div>

            <div className="panel-spacer"></div>

            <div className="spin-actions">
              <button
                className={`spin-btn ${spinning ? 'spinning' : ''}`}
                disabled={spinning || loading}
                onClick={() => {
                  if (!state.connected) { setConnectStep(1); setShowConnect(true); return; }
                  if (state.spinsAvailable <= 0) { setShowTasks(true); return; }
                  doSpin();
                }}
              >
                {!state.connected ? 'CONNECT TO DEGEN' : (state.spinsAvailable === 0 ? 'GET SPINS' : 'RISKIIIT!')}
              </button>
            </div>
            <p className="disclaimer">
              Chance-based rewards may qualify as gaming in some regions · 1 wallet = 1 entry · min. 30-day X account. Slop responsibly.
            </p>
          </section>

          {/* Right: Wheel */}
          <section className="wheel-card">
            {/* Share button above the wheel scene */}
            <div className="wheel-share-bar">
              <button className="share-bar-btn" onClick={() => {
                if (!state.connected) { setConnectStep(1); setShowConnect(true); }
                else shareToTwitter(`Spinning the @SLOBOS wheel for a GTD whitelist spot 👇\n${refLink()}`);
              }}>
                <svg className="gh-ico" fill="currentColor"><use href="#icoShare"/></svg>
                <span>Share &amp; Invite</span>
              </button>
            </div>
            <div className={`wheel-scene ${spinning ? 'is-spinning' : ''}`}>
              <div className="glow"></div>
              <div className="gambler" aria-hidden="true">
                <svg className="gambler-head"><use href="#sloboHead"/></svg>
              </div>
              <svg className="paw paw-l" aria-hidden="true"><use href="#sloboPaw"/></svg>
              <svg className="paw paw-r" aria-hidden="true"><use href="#sloboPaw"/></svg>
              <div className="wheel-stage" ref={wheelStageRef}>
                <div className="pointer"></div>
                <div className="wheel" ref={wheelRef}></div>
                <div className="wheel-hub"></div>
                <div className="ball" ref={ballRef}></div>
              </div>
              <div className="scanlines"></div>
              {flash && (
                <div className="result-flash show" style={{color: flash.color}}>{flash.text}</div>
              )}
            </div>
            <div className="wheel-foot">
              <span className="live-dot"></span> Provably fair · settles on
              <svg className="feather-sm"><use href="#rhFeather"/></svg> Robinhood Chain
            </div>
          </section>
        </main>

        {/* History */}
        <div className="history">
          {state.history.slice(-12).reverse().map((r, i) => (
            <span key={i} className={`chip ${r}`}>
              {r === 'green' ? 'WL' : r === 'black' ? '+Ticket' : 'Red'}
            </span>
          ))}
        </div>

        {/* Promo */}
        <section className="promo">
          <img src="/assets/banner.gif" alt="SLOBOS × Robinhood Chain" />
        </section>
      </div>

      {/* ===== MODALS ===== */}

      {/* Stepwise Connect Modal */}
      <Modal isOpen={showConnect} onClose={() => setShowConnect(false)}>
        <div className="pfp-strip" aria-hidden="true">
          <img className="avatar" src={PFPS[0]} alt="" />
          <img className="avatar" src={PFPS[1]} alt="" />
          <img className="avatar" src={PFPS[2]} alt="" />
          <svg className="you-mark" aria-hidden="true"><use href="#sloboHead"/></svg>
        </div>

        {connectStep === 1 && (
          <>
            <h2>Step 1 · Connect Wallet</h2>
            <p className="sub">Connect your MetaMask wallet to get started. 1 wallet = 1 entry.</p>
            <div className="gate-step">
              <span className="dot">1</span>
              <span style={{flex:1}}>Connect MetaMask</span>
            </div>
            <button className="primary" onClick={handleConnectWallet}>Connect MetaMask</button>
            <button className="secondary" onClick={() => setShowConnect(false)}>Cancel</button>
          </>
        )}

        {connectStep === 2 && (
          <>
            <h2>Step 2 · Username</h2>
            <p className="sub">Choose a username for the leaderboard.</p>
            <div className="gate-step done">
              <span className="dot">✓</span>
              <span style={{flex:1}}>Wallet: {connectedWallet?.slice(0,6)}...{connectedWallet?.slice(-4)}</span>
            </div>
            <div className="gate-step">
              <span className="dot">2</span>
              <span style={{flex:1}}>Username</span>
            </div>
            <label>Username</label>
            <input type="text" placeholder="your_name" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmitUsername()} />
            <button className="primary" onClick={handleSubmitUsername}>Continue</button>
            <button className="secondary" onClick={() => setConnectStep(1)}>Back</button>
          </>
        )}

        {connectStep === 3 && (
          <>
            <h2>Step 3 · Twitter / X</h2>
            <p className="sub">Link your X account to unlock spins.</p>
            <div className="gate-step done">
              <span className="dot">✓</span>
              <span style={{flex:1}}>Wallet connected</span>
            </div>
            <div className="gate-step done">
              <span className="dot">✓</span>
              <span style={{flex:1}}>Username: {usernameInput}</span>
            </div>
            <div className="gate-step">
              <span className="dot">3</span>
              <span style={{flex:1}}>Twitter handle</span>
            </div>
            <label>X / Twitter Handle</label>
            <input type="text" placeholder="@yourhandle" value={twitterInput} onChange={e => setTwitterInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmitTwitter()} />
            <button className="primary" onClick={handleSubmitTwitter}>Complete Signup</button>
            <button className="secondary" onClick={() => setConnectStep(2)}>Back</button>
          </>
        )}
      </Modal>

      {/* Result Modal */}
      <Modal isOpen={showResult} onClose={() => setShowResult(false)}>
        <div className="wl-win">
          <div className="big">{resultData.result === 'green' ? '🟢' : resultData.result === 'black' ? '🎟️' : '🔴'}</div>
          <h2>{resultData.label}</h2>
          <p className="sub">{resultData.result !== 'red' ? 'Nice. Share your result — turn it into distribution.' : 'No luck. Share it anyway and pull friends into the wheel.'}</p>
          <p className="sub" style={{marginBottom: '8px'}}>Your raffle tickets: <b style={{color:'var(--txt)'}}>{state.tickets}</b> · WL: <b style={{color:'var(--mint)'}}>{state.wonWL ? 'SECURED' : 'not yet'}</b></p>
          <a className="primary" style={{display:'block', textDecoration:'none', boxSizing:'border-box', textAlign:'center'}} target="_blank"
             href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just spun ${resultData.result.toUpperCase()} on the @SLOBOS wheel and got: ${resultData.label}. Spin for a GTD whitelist spot 👇\n${refLink()}`)}`}>
            Share result on X
          </a>
          <div className="referral-box">
            <input type="text" readOnly value={refLink()} />
            <button className="secondary" style={{margin:0}} onClick={() => { navigator.clipboard?.writeText(refLink()); toast('Link copied'); }}>Copy</button>
          </div>
          <button className="secondary" onClick={() => setShowResult(false)}>{state.spinsAvailable > 0 ? 'Spin again' : 'Done'}</button>
        </div>
      </Modal>

      {/* Tasks Modal */}
      <Modal isOpen={showTasks} onClose={() => setShowTasks(false)}>
        <h2>🎯 Available Tasks</h2>
        <p className="sub">Complete tasks to earn more spins. Every task is free!</p>
        {tasks.map(t => (
          <div key={t.taskId} className="task-row">
            <div className="task-info">
              <div className="task-title">{t.title}</div>
              <div className="task-desc">{t.description}</div>
            </div>
            {completedTasks.includes(t.taskId) ? (
              <span className="task-done">✓ DONE</span>
            ) : pendingTasks[t.taskId] ? (
              <span className="task-pending"><span className="dot-loader"></span>Claiming</span>
            ) : (
              <button className="task-btn" onClick={() => startTaskVerification(t.taskId, t.actionLink)}>
                +{t.rewardSpins} SPINS
              </button>
            )}
          </div>
        ))}
        {tasks.length === 0 && <p style={{color:'var(--faint)', padding:'20px 0'}}>No tasks available right now. Check back later!</p>}
        <button className="secondary" style={{marginTop:'16px'}} onClick={() => setShowTasks(false)}>Close</button>
      </Modal>

      {/* Info / How It Works */}
      <Modal isOpen={showInfo} onClose={() => setShowInfo(false)}>
        <h2>How it works</h2>
        <p className="sub">Spin the 3-color wheel. Refer friends for bonus spins. Climb the leaderboard.</p>
        <div className="lb-row"><span className="who">🔴 Red (45%)</span><span>Nothing — come back tomorrow</span></div>
        <div className="lb-row"><span className="who">⚫ Black (45%)</span><span>+1 raffle ticket</span></div>
        <div className="lb-row"><span className="who">🟢 Green (~8%)</span><span>GTD whitelist spot</span></div>
        <hr style={{border:'none', borderTop:'1px solid var(--line)', margin:'14px 0'}} />
        <p className="sub" style={{marginBottom:'10px'}}><b style={{color:'var(--txt)'}}>Referral:</b> New wallet spins via your code → you get +1 spin + 1 ticket.</p>
        <p className="sub" style={{marginBottom:'10px'}}><b style={{color:'var(--txt)'}}>Streaks:</b> 3-day streak = +1 bonus spin. 7-day = tier upgrade.</p>
        <p className="sub"><b style={{color:'var(--txt)'}}>Tasks:</b> Complete free tasks to earn more spins. No purchase required.</p>
        <button className="secondary" style={{marginTop:'16px'}} onClick={() => setShowInfo(false)}>Got it</button>
      </Modal>

      {/* Account Info */}
      <Modal isOpen={showAccount} onClose={() => setShowAccount(false)}>
        <h2 style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <svg className="you-mark" aria-hidden="true"><use href="#sloboHead"/></svg> {state.twitter}
        </h2>
        <p className="sub">{state.wallet}</p>
        <div className="lb-row"><span className="who">Raffle tickets</span><span className="refs">{state.tickets}</span></div>
        <div className="lb-row"><span className="who">Whitelist</span><span className="refs">{state.wonWL ? 'SECURED 🎉' : '—'}</span></div>
        <div className="lb-row"><span className="who">Referrals</span><span className="refs">{state.referrals}</span></div>
        <label>Your referral link</label>
        <div className="referral-box">
          <input type="text" readOnly value={refLink()} />
          <button className="secondary" style={{margin:0}} onClick={() => { navigator.clipboard?.writeText(refLink()); toast('Copied'); }}>Copy</button>
        </div>
        <button className="secondary" style={{marginTop:'16px'}} onClick={() => { localStorage.removeItem('slobos_wallet'); window.location.reload(); }}>Logout</button>
        <button className="secondary" onClick={() => setShowAccount(false)}>Close</button>
      </Modal>

      {/* Toast */}
      {toastMsg && <div className={`toast ${toastType === 'success' ? 'toast-success' : ''}`}>{toastMsg}</div>}
    </>
  );
}

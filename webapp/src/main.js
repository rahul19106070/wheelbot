import './style.css';

const API_BASE = 'http://localhost:3000/api'; // Update this for production

let tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

const wheel = document.getElementById('wheel');
const spinBtn = document.getElementById('spinBtn');
const mainBalanceEl = document.getElementById('mainBalance');
const energyCountEl = document.getElementById('energyCount');
const energyCountHeaderEl = document.getElementById('energyCountHeader');

// Wallet UI Elements
const mainPage = document.getElementById('main-page');
const walletPage = document.getElementById('wallet-page');
const openWalletBtn = document.getElementById('openWalletBtn');
const backToMainBtn = document.getElementById('backToMainBtn');
const walletBalanceEl = document.getElementById('walletBalance');
const walletEnergyCountEl = document.getElementById('walletEnergyCount');
const addUpiBtn = document.getElementById('addUpiBtn');
const upiStatusText = document.getElementById('upiStatusText');

// User details
const user = tg.initDataUnsafe?.user || { id: 12345678, first_name: 'Test', username: 'tester' };
if (user) {
  document.getElementById('userName').textContent = user.first_name;
  document.getElementById('userId').textContent = `ID: ${user.id}`;
  document.getElementById('userAvatar').textContent = user.first_name.charAt(0);
}

// State
let balance = 0;
let spinsLeft = 1;
let upiId = null;
let isSpinning = false;
let currentRotation = 0;

// Segments setup (match aesthetic image)
const segments = [
  { text: '0.01', val: 0.01, type: 'cash', image: '/assets/3d_gold_coin_1786024703243.jpg' },
  { text: '0.10', val: 0.10, type: 'cash', image: '/assets/3d_money_bag_1786024766958.jpg' },
  { text: '0.25', val: 0.25, type: 'cash', image: '/assets/3d_cash_stack_1786024726937.jpg' },
  { text: '0.50', val: 0.50, type: 'cash', image: '/assets/3d_purple_diamond_1786024715075.jpg' },
  { text: '1.00', val: 1.00, type: 'cash', image: '/assets/3d_cash_stack_1786024726937.jpg' },
  { text: 'Oops', val: 0.00, type: 'empty', icon: '💩' },
  { text: '+1 Spin', val: 0, type: 'spin', image: '/assets/3d_mini_wheel_1786024777301.jpg' },
  { text: '0.05', val: 0.05, type: 'cash', image: '/assets/3d_cash_note_1786024755662.jpg' }
];

function drawWheel() {
  const angle = 360 / segments.length;
  wheel.innerHTML = '';
  segments.forEach((seg, i) => {
    const div = document.createElement('div');
    div.className = 'segment';
    div.style.transform = `rotate(${i * angle}deg) translate(0, -50%) skewY(${90 - angle}deg)`;
    
    const textSpan = document.createElement('div');
    textSpan.className = 'segment-content';
    textSpan.style.transform = `skewY(-${90 - angle}deg) rotate(${angle/2}deg) translate(0, -25px)`;
    
    // Create icon and text
    let iconEl;
    if (seg.image) {
      iconEl = document.createElement('img');
      iconEl.className = 'segment-img';
      iconEl.src = seg.image;
    } else {
      iconEl = document.createElement('span');
      iconEl.className = 'segment-icon';
      iconEl.textContent = seg.icon;
    }
    
    const labelEl = document.createElement('span');
    labelEl.className = 'segment-label';
    labelEl.textContent = seg.type === 'cash' ? `$${seg.text}` : seg.text;
    
    textSpan.appendChild(iconEl);
    textSpan.appendChild(labelEl);
    div.appendChild(textSpan);
    wheel.appendChild(div);
  });
}

function updateUI() {
  mainBalanceEl.textContent = balance.toFixed(2);
  walletBalanceEl.textContent = balance.toFixed(2);
  
  // Progress bar logic (Target $1.00)
  const progressFill = document.querySelector('.progress-fill');
  const progressText = document.querySelector('.progress-text');
  const percentage = Math.min((balance / 1.00) * 100, 100);
  if (progressFill) progressFill.style.width = `${percentage}%`;
  
  const remaining = Math.max(1.00 - balance, 0);
  if (progressText) {
    if (remaining > 0) {
      progressText.textContent = `Only $${remaining.toFixed(2)} to cash out $1!`;
    } else {
      progressText.textContent = `You can cash out now!`;
    }
  }
  
  if (energyCountEl) energyCountEl.textContent = spinsLeft;
  if (energyCountHeaderEl) energyCountHeaderEl.textContent = spinsLeft;
  if (walletEnergyCountEl) walletEnergyCountEl.textContent = spinsLeft;
  
  if (upiId) {
    upiStatusText.textContent = upiId;
    addUpiBtn.textContent = 'Edit';
  }
}

async function fetchUserData() {
  try {
    const res = await fetch(`${API_BASE}/user?id=${user.id}`);
    const data = await res.json();
    if (!data.error) {
      balance = data.balance;
      spinsLeft = data.spinsLeft;
      upiId = data.upiId;
      updateUI();
    }
  } catch (err) {
    console.error("Failed to fetch user data:", err);
  }
}

async function processSpin(prize) {
  try {
    const res = await fetch(`${API_BASE}/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, winAmount: prize.val, prizeType: prize.type })
    });
    const data = await res.json();
    if (data.success) {
      balance = data.balance;
      spinsLeft = data.spinsLeft;
      updateUI();
    }
  } catch (err) {
    console.error("Spin API failed:", err);
  }
}

async function saveUpi(newUpi) {
  try {
    const res = await fetch(`${API_BASE}/upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, upiId: newUpi })
    });
    const data = await res.json();
    if (data.success) {
      upiId = data.upiId;
      updateUI();
      tg.showAlert("UPI ID Saved!");
    }
  } catch (err) {
    console.error("UPI Save API failed:", err);
  }
}

// Modal Logic
const winModal = document.getElementById('winModal');
const modalImage = document.getElementById('modalImage');
const modalAmount = document.getElementById('modalAmount');
const modalGoOnBtn = document.getElementById('modalGoOnBtn');

modalGoOnBtn.addEventListener('click', () => {
  winModal.style.display = 'none';
});

spinBtn.addEventListener('click', () => {
  if (isSpinning) return;
  if (spinsLeft <= 0) {
    tg.showAlert('No spins left! Refer friends to get 5 more spins!');
    return;
  }
  
  isSpinning = true;
  if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('heavy');
  
  const winningIndex = Math.floor(Math.random() * segments.length);
  const prize = segments[winningIndex];
  
  const spinTime = 4000;
  const extraRotations = 5;
  const segmentAngle = 360 / segments.length;
  
  const targetRotation = currentRotation + (360 * extraRotations) + (360 - (winningIndex * segmentAngle));
  currentRotation = targetRotation;
  
  wheel.style.transform = `rotate(${currentRotation}deg)`;
  
  setTimeout(() => {
    isSpinning = false;
    if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    
    if (prize.type === 'cash' && prize.val > 0) {
      document.querySelector('.modal-title').textContent = 'Congratulations!';
      modalImage.src = prize.image;
      modalImage.style.display = 'block';
      modalAmount.textContent = `$${prize.val.toFixed(2)}`;
      winModal.style.display = 'flex';
    } else if (prize.type === 'spin') {
      document.querySelector('.modal-title').textContent = 'WOW!';
      modalImage.src = prize.image;
      modalImage.style.display = 'block';
      modalAmount.textContent = '+1 SPIN';
      winModal.style.display = 'flex';
    } else {
      document.querySelector('.modal-title').textContent = 'Oops!';
      modalImage.style.display = 'none';
      modalAmount.textContent = 'Better luck next time!';
      winModal.style.display = 'flex';
    }
    
    processSpin(prize);
  }, spinTime);
});

// Navigation
openWalletBtn.addEventListener('click', () => {
  mainPage.style.display = 'none';
  walletPage.style.display = 'flex';
});

backToMainBtn.addEventListener('click', () => {
  walletPage.style.display = 'none';
  mainPage.style.display = 'flex';
});

// Add UPI
addUpiBtn.addEventListener('click', () => {
  tg.showPopup({
    title: 'Add UPI ID',
    message: 'Please verify your UPI ID with our bot using command /add_upi. Just kidding, enter it below:',
    buttons: [{type: 'ok'}]
  }, () => {
      const input = prompt("Enter your UPI ID (e.g., name@okicici)");
      if (input && input.includes('@')) {
         saveUpi(input);
      } else if (input) {
         tg.showAlert('Invalid UPI ID! Must contain @');
      }
  });
});

document.getElementById('inviteBtn').addEventListener('click', () => {
  const inviteLink = `https://t.me/share/url?url=https://t.me/YourBotUsername?start=ref_${user.id}&text=Spin the wheel to earn real USDT!`;
  tg.openTelegramLink(inviteLink);
});

// Initialization
drawWheel();
fetchUserData();

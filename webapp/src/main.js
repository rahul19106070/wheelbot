import './style.css'

// Initialize Telegram Web App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Initialize User Data
const initUser = () => {
  if (tg.initDataUnsafe?.user) {
    const user = tg.initDataUnsafe.user;
    document.getElementById('userName').textContent = user.first_name;
    document.getElementById('userId').textContent = `ID: ${user.id}`;
    document.getElementById('userAvatar').textContent = user.first_name.charAt(0);
  }
};

initUser();

// Wheel Logic
const prizes = [
  "Raffle", "$0.50", "Gift", "$0.10", 
  "Team", "$1.00", "Contest", "Try Again"
];

const wheel = document.getElementById('wheel');
const spinBtn = document.getElementById('spinBtn');
let currentRotation = 0;
let isSpinning = false;
let energy = 5;
let balance = 0.46;

// Create segment text dynamically
const createSegments = () => {
  const segmentAngle = 360 / prizes.length;
  
  prizes.forEach((prize, index) => {
    const seg = document.createElement('div');
    seg.className = 'segment';
    
    // Calculate rotation to place text properly within the conic gradient slices
    const rotation = (index * segmentAngle) + (segmentAngle / 2);
    
    seg.style.transform = `rotate(${rotation}deg) translateY(-85px) rotate(-90deg)`;
    seg.style.position = 'absolute';
    seg.style.top = '50%';
    seg.style.left = '50%';
    seg.style.transformOrigin = '0 0';
    seg.style.width = '100px';
    seg.style.textAlign = 'center';
    seg.style.color = '#111';
    seg.style.fontWeight = 'bold';
    seg.style.fontSize = '0.9rem';
    
    seg.textContent = prize;
    wheel.appendChild(seg);
  });
};

createSegments();

const updateDisplay = () => {
  document.getElementById('energyCount').textContent = energy;
  document.getElementById('mainBalance').textContent = balance.toFixed(2);
};

const spinWheel = () => {
  if (isSpinning || energy <= 0) {
    if (energy <= 0) tg.showAlert("Not enough energy! Invite friends to get more.");
    return;
  }
  
  isSpinning = true;
  energy -= 1;
  updateDisplay();
  tg.HapticFeedback.impactOccurred('medium');

  // Random degree between 360 * 5 and 360 * 8 for plenty of spins
  const randomSpins = Math.floor(Math.random() * 3 + 5) * 360;
  // Random extra degree to land on a specific slice
  const extraDegrees = Math.floor(Math.random() * 360);
  
  currentRotation += randomSpins + extraDegrees;
  
  wheel.style.transform = `rotate(${currentRotation}deg)`;
  
  setTimeout(() => {
    isSpinning = false;
    tg.HapticFeedback.notificationOccurred('success');
    
    // Calculate winning segment
    const normalizedRotation = currentRotation % 360;
    // The top pointer is at 0 degrees.
    // CSS rotation goes clockwise. Conic gradient starts at 0 (top) and goes clockwise.
    // So if wheel is rotated by R, the segment at the top is (360 - R) % 360.
    const segmentAngle = 360 / prizes.length;
    let winningAngle = (360 - normalizedRotation) % 360;
    // Add offset because our first slice starts at 0 and goes to 45
    const index = Math.floor(winningAngle / segmentAngle);
    const prize = prizes[index];
    
    if (prize.startsWith('$')) {
        const amount = parseFloat(prize.replace('$', ''));
        balance += amount;
        updateDisplay();
        tg.showAlert(`🎉 You won ${prize}!`);
    } else if (prize === 'Try Again') {
        tg.showAlert(`😢 Oh no! Try again.`);
    } else {
        tg.showAlert(`🎫 You received a ${prize} entry!`);
    }

  }, 4000); // 4s matches the CSS transition time
};

spinBtn.addEventListener('click', spinWheel);

document.getElementById('inviteBtn').addEventListener('click', () => {
  tg.openTelegramLink(`https://t.me/share/url?url=https://t.me/WheelEarnBot&text=Join me and earn real money!`);
});

let cubeSize = 100;
let minCubeSize = 50;
let maxCubeSize = 500;
let defaultCubeSize = 100;

let textures = {};
let rotation = 0;

let proximityHistory = [];
let filterSize = 6;

let port;
let reader;
let decoder = new TextDecoder();
let buffer = '';

let isWarmingUp = false;
let calibrationDiv;

function preload() {
  textures.front = loadImage('front.jpg');
  textures.back = loadImage('back.jpg');
  textures.left = loadImage('left.jpg');
  textures.right = loadImage('right.jpg');
  textures.top = loadImage('top.jpg');
  textures.bottom = loadImage('bottom.jpg');
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  for (let i = 0; i < filterSize; i++) {
    proximityHistory[i] = defaultCubeSize;
  }

  calibrationDiv = select('#calibration-message');

  const button = createButton('Connect to Proximity Interface');
  button.position(10, 10);
  button.mousePressed(connectSerial);

  rawValueDiv = createDiv('Raw Value: ---');
  rawValueDiv.position(10, 50); // just below the button
  rawValueDiv.style('font-size', '16px');
  rawValueDiv.style('color', '#333');
}

function draw() {
  background(255);
  noLights();
  noStroke();

  if (isNaN(cubeSize) || cubeSize <= 0) {
    cubeSize = defaultCubeSize;
  }

  rotateX(rotation * 0.01);
  rotateY(rotation * 0.01);
  drawTexturedCube(cubeSize);
  rotation++;
}

function drawTexturedCube(s) {
  let half = s / 2;

  push(); translate(0, 0, half); texture(textures.front); plane(s, s); pop();
  push(); rotateY(PI); translate(0, 0, half); texture(textures.back); plane(s, s); pop();
  push(); rotateY(HALF_PI); translate(0, 0, half); texture(textures.right); plane(s, s); pop();
  push(); rotateY(-HALF_PI); translate(0, 0, half); texture(textures.left); plane(s, s); pop();
  push(); rotateX(-HALF_PI); translate(0, 0, half); texture(textures.top); plane(s, s); pop();
  push(); rotateX(HALF_PI); translate(0, 0, half); texture(textures.bottom); plane(s, s); pop();
}

function updateFilteredSize(newVal) {
  proximityHistory.push(newVal);
  if (proximityHistory.length > filterSize) {
    proximityHistory.shift();
  }
  let sum = proximityHistory.reduce((a, b) => a + b, 0);
  cubeSize = constrain(sum / filterSize, minCubeSize, maxCubeSize);
}

// Serial Setup with warm-up delay
async function connectSerial() {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    console.log('Serial port opened.');

    isWarmingUp = true;
    calibrationDiv.style('display', 'block');

    setTimeout(() => {
      isWarmingUp = false;
      calibrationDiv.style('display', 'none');
      console.log('Sensor is ready.');
      readLoop();
    }, 3000);
  } catch (err) {
    console.error('Serial connection error:', err);
  }
}

// Serial Reader
async function readLoop() {
  reader = port.readable.getReader();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop();

      for (let line of lines) {
        line = line.trim();
        if (line.length > 0) {
          console.log('Received:', line);
          let num = parseFloat(line);
          if (!isNaN(num)) {
            // Cap values above 500 to 500
            let safeVal = constrain(num, 0, 500);
            updateFilteredSize(safeVal);

            // Update raw value display
            rawValueDiv.html('Raw Value: ' + num.toFixed(2));
          } else {
            console.warn("Invalid input, using default.");
            updateFilteredSize(defaultCubeSize);
          }
        }
      }
    }
  } catch (err) {
    console.error('Serial read error:', err);
  } finally {
    reader.releaseLock();
  }
}

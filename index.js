const request = require('request');
const Decimal = require('decimal.js');
const cron = require('node-cron');
const moment = require('moment');
const zaif = require('zaif.jp');
const api = zaif.PublicApi;


if (process.argv.length !== 5) {
  console.log('Usage: notify.js currencyPair timeScale(min) maxPer(float)');
  console.log('ex) notify.js btc_jpy 30 0.1')
  process.exit();
}

const currencyPair = process.argv[2];       // btc_jpy
const timeScale = Number(process.argv[3]);  // 30       (分)
const maxPer = Number(process.argv[4]);     // 0.1      (倍)

// valueをunitStepで丸めて返す関数
roundUnit = (value, unitStep) => {
  const src = Decimal(value);
  const result = src.div(unitStep).floor().times(unitStep).toNumber();

  return result;
}

// Crystal Signal PiのAPIを叩いて光らせる関数
const shineLight = (color, period) => {
  const options = {
    uri: "http://localhost/ctrl",
    qs: {
      "color": color,
      "mode": "1",
      "repeat": "0",
      "period": period,
      "json": "1"
    }
  }
  request.get(options);
}


const job = cron.schedule(`*/${timeScale} * * * *`, async () => {
  const beforePrice = (await api.lastPrice(currencyPair)).last_price;
  console.log(`${moment().format('HH:mm:ss')}  ${beforePrice}`);

  let tmp = {price: null, color: null};
  const w = zaif.createStreamApi(currencyPair, data => {
    const nowPrice = data.last_price.price;
    const nowPer = Math.abs(nowPrice / beforePrice - 1);
    const roundedPer = roundUnit(nowPer / maxPer, 0.1);

    if (nowPrice !== tmp.price) {

      let color;
      let colorBright = 255;
      let period = '300';
      if (nowPer < maxPer) {
        colorBright = Math.floor(10 + 245 * roundedPer);
        period = Math.floor(2100 - 1800 * roundedPer).toString();
      }

      if (nowPrice > beforePrice) {
        color = `0,0,${colorBright}`;
      } else if (nowPrice < beforePrice) {
        color = `${colorBright},0,0`;
      } else {
        color = '0,50,0';
      }

      if (tmp.color !== color) {
        shineLight(color, period);
        tmp.color = color;
      }

      tmp.price = nowPrice;
    }
  });
}, true);

job.start();

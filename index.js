require('dotenv').config();
const axios = require('axios').default;
const cheerio = require('cheerio');
const sgMail = require('@sendgrid/mail');

const knex = require('knex')({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  },
});

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const getNewListings = async (url) => {
  const listingTimestamps = await knex('listing_timestamps');
  const html = await axios.get(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const listings = $('tbody .views-field.views-field-title');
  const newListings = [];
  listings.each((i, listing) => {
    const title = $(listing).text().trim();
    const timestamp = title.split(' » ')[1];
    const link = $(listing).find('a').attr('href');
    if (!listingTimestamps.find((lt) => lt.timestamp === timestamp)) {
      newListings.push({
        timestamp,
        title,
        link: 'https://www.fiberglass-rv-4sale.com' + link,
      });
    }
  });
  return newListings;
};

const sendListings = async (newListings) => {
  await sgMail.send({
    from: 'Fiberglass Finder <alextmortensen@gmail.com>',
    to: 'alextmortensen@gmail.com',
    subject: 'NEW LISTINGS',
    html: newListings
      .map((l) => `- <a href="${l.link}">${l.title}</a>`)
      .join('<br><br>'),
  });

  await knex('listing_timestamps').insert(
    newListings.map((l) => ({ timestamp: l.timestamp }))
  );
};

const run = async () => {
  try {
    const casitas = await getNewListings(
      'https://www.fiberglass-rv-4sale.com/casita-trailers-for-sale'
    );
    const scamps = await getNewListings(
      'https://www.fiberglass-rv-4sale.com/scamp-trailers-for-sale'
    );
    if (scamps.length || casitas.length) {
      await sendListings([...casitas, ...scamps]);
    }
    console.log('ran');
  } catch (err) {
    console.log('failed', err);
    await sgMail.send({
      from: 'Fiberglass Finder <alextmortensen@gmail.com>',
      to: 'alextmortensen@gmail.com',
      subject: 'ERROR',
      text: err.message,
    });
  }
};

run();

setInterval(run, 1000 * 60 * 60);

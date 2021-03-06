const winston = require('winston');

const puppeteer = require('puppeteer');
const HEADLESS = true;

module.exports.createEntryList = createEntryList;

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

async function createEntryList(url) {
    let entryList = await fetchDBLP(url);
    await setBitTex(entryList);
    return entryList;
}

async function fetchDBLP(url) {
    let browser = await puppeteer.launch({ headless: HEADLESS });
    let page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });

    logger.info('OPEN DBLP');

    let entryList = await page.evaluate(() => {

        const ENTRY_SELECTOR = '#publ-section li.entry';
        const CONF_JOURN_IMG_SELECTOR = 'div.box img';
        const NUMBER_SELECTOR = 'div.nr';
        const ENTRY_LINK_SELECTOR = 'cite > a';
        const ENTRY_IN_NAME_SELECTOR = 'cite > a > span > span';
        const ENTRY_TITLE_SELECTOR = 'span.title';
        const BIB_ENTRY = 'nav.publ div.head';

        const CONF_IMG_TITLE = 'Conference and Workshop Papers';
        const JOURNAL_IMG_TITLE = 'Journal Articles';

        let extractedEntryList = [];
        let entryList = document.querySelectorAll(ENTRY_SELECTOR);
        entryList.forEach(entry => {
            let extractedEntry = {};

            let img = entry.querySelector(CONF_JOURN_IMG_SELECTOR);
            switch (img.title) {
                case JOURNAL_IMG_TITLE: extractedEntry.kind = 'journal';
                    break;
                case CONF_IMG_TITLE: extractedEntry.kind = 'conference';
                    break;
                default: extractedEntry.kind = undefined;
            }

            if (entry.querySelector(NUMBER_SELECTOR)) {
                extractedEntry.number = entry.querySelector(NUMBER_SELECTOR).id;
            }

            if (entry.querySelector(ENTRY_LINK_SELECTOR)) {
                extractedEntry.link = entry.querySelector(ENTRY_LINK_SELECTOR).href;
            }

            if (entry.querySelector(ENTRY_IN_NAME_SELECTOR)) {
                extractedEntry.in = entry.querySelector(ENTRY_IN_NAME_SELECTOR).innerText;
            }

            if (entry.querySelector(ENTRY_TITLE_SELECTOR)) {
                extractedEntry.title = entry.querySelector(ENTRY_TITLE_SELECTOR).innerText;
            }

            extractedEntry.year = getYear(entry);

            extractedEntry.bibHref = entry.querySelectorAll(BIB_ENTRY)[1].children[0].href;

            if (extractedEntry.kind) {
                extractedEntryList.push(extractedEntry);
            }

        });
        return extractedEntryList;

        function getYear(node) {
            let previous = node.previousElementSibling;
            if (previous.className === 'year') {
                return parseInt(previous.innerText);
            } else {
                return getYear(previous);
            }
        }
    });

    logger.info('GET DBLP ENTRIES');

    for (let index = 0; index < entryList.length; index++) {
        if (entryList[index].kind === 'journal') {
            await page.goto(entryList[index].link, { waitUntil: "domcontentloaded" });
            let inFull = await page.evaluate(() => {
                return document.querySelector('h1').innerHTML;
            });
            entryList[index].inFull = inFull;
            logger.info(`GET FULL JOURNAL NAME: ${inFull}`);
        }
    }

    await page.close();

    await browser.close();

    return entryList;
}


async function setBitTex(entryList) {
    const CROSS_REF_OPTIONS_SELECTOR = '#sorting-selector > div > div.body > ul';

    let browser = await puppeteer.launch({ headless: HEADLESS });
    let page = await browser.newPage();

    logger.info('FETCH BIBTex');
    

    for (let indexEntry = 0; indexEntry < entryList.length; indexEntry++) {
        let entry = entryList[indexEntry];
        logger.info('get bibHref:'+entry.bibHref);
        await page.goto(entry.bibHref);
        await page.waitFor(CROSS_REF_OPTIONS_SELECTOR);
        let bibURL = await page.$eval(CROSS_REF_OPTIONS_SELECTOR, option => {
            for (let i = 0; i < option.childElementCount; i++) {
                const value = option.children[i].children[0].innerText;
                if (value === "standard") {
                    return option.children[i].children[0].href;
                }
            }
            return undefined;
        });
        if (bibURL) {
            entry.standardBibURL = bibURL;
        } else {
            entry.standardBibURL = entry.bibHref;
        }
    }

    const BIB_SECTION_SELECTOR = '#bibtex-section > pre';
    for (let indexEntry = 0; indexEntry < entryList.length; indexEntry++) {
        let entry = entryList[indexEntry];
        logger.info('get standard bibHref:'+entry.standardBibURL);
        if (entry.standardBibURL) {
            await page.goto(entry.standardBibURL);
            await page.waitFor(BIB_SECTION_SELECTOR);
            let bibtex = await page.$eval(BIB_SECTION_SELECTOR, bib => bib.innerText);
            entry.bibtex = bibtex;
        }
    }
    await page.close();
    await browser.close();
}


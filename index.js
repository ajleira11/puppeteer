//This version will run locally and save a .json file and .png image
//use node workable.js
const fs = require("fs");
const { join } = require("path");
const puppeteer = require("puppeteer");

async function run() {
  try {
    const leverURL = "https://www.lever.co/";
    const inputURL = "https://jobs.lever.co/safetyculture-2/";
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    console.log("Launching browser...");

    await page.goto(inputURL);
    console.log("Navigating to:", inputURL);

    // Wait for the job listings to load to ensure data exists
    await page.waitForSelector(".posting");

    //capture the Company Name fromm the page title
    const companyName = await page.$eval(
      'meta[name="twitter:title"]',
      (element) => element.getAttribute("content")
    );

    console.log("Company Name:", companyName);

    const jobs = await page.$$eval(".postings-group .posting", (elements) =>
      elements.map((posting) => {
        const areasElement = posting
          .closest(".postings-group")
          .querySelector(".large-category-label");
        const areas = areasElement ? areasElement.innerText : ""; //returning an error when its empty
        //posting.closest(".posting-group").querySelector(".large-category-label");
        const workTypeElement = posting.querySelector(
          ".posting-categories .sort-by-commitment"
        );
        const workType = workTypeElement ? workTypeElement.innerText : ""; // return an empty string if workType is empty

        return {
          areas: areas,
          title: posting.querySelector(
            ".posting-title h5[data-qa='posting-name']"
          ).innerText,
          location: posting.querySelector(
            ".posting-title .posting-categories .sort-by-location"
          ).innerText,
          workStyle: posting.querySelector(
            ".posting-categories .workplaceTypes"
          ).innerText,
          workType: workType,
          jobURL: posting.querySelector(".posting .posting-title").href,
        };
      })
    );

    //open job links and add the description inside the jobs list
    await Promise.all(
      jobs.map(async (job) => {
        const jobLandingPage = await browser.newPage();
        await jobLandingPage.goto(job.jobURL);
        job.description = await jobLandingPage.$eval(
          'meta[property="og:description"]', // Selector for the meta tag containing the description
          (element) =>
            element ? element.getAttribute("content") : 12837192847985623956235
        );

        await jobLandingPage.close();
      })
    );

    console.log("Jobs:", jobs, jobs.length);
    // jobs.forEach((job) => {
    //   console.log("Job Description:", job.description);
    // });

    await browser.close();
    // console.log("Browser closed.");
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

run();

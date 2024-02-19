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

    const jobs = await page.$$eval(
      ".postings-group .posting",
      (postings, companyName) =>
        postings.map((posting) => {
          const areasElement = posting
            .closest(".postings-group")
            .querySelector(".large-category-label");
          const areas = areasElement ? areasElement.innerText : "";
          const workTypeElement = posting.querySelector(
            ".posting-categories .sort-by-commitment"
          );
          const workType = workTypeElement ? workTypeElement.innerText : "";

          const titleElement = posting.querySelector(
            ".posting-title h5[data-qa='posting-name']"
          );
          const locationElement = posting.querySelector(
            ".posting-title .posting-categories .sort-by-location"
          );
          const workStyleElement = posting.querySelector(
            ".posting-categories .workplaceTypes"
          );
          const jobURLElement = posting.querySelector(
            ".posting .posting-title"
          );

          return {
            companyName: companyName,
            areas: areas,
            title: titleElement ? titleElement.innerText : "",
            location: locationElement ? locationElement.innerText : "",
            workStyle: workStyleElement ? workStyleElement.innerText : "",
            workType: workType,
            jobURL: jobURLElement ? jobURLElement.href : "",
          };
        }),
      companyName
    );

    const updatedJobs = await addDescription(jobs, browser);

    //open job links and add the description inside the jobs list
    console.log("Jobs:", updatedJobs, updatedJobs.length);

    await browser.close();
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function addDescription(jobs, browser) {
  try {
    for (const job of jobs) {
      const jobLandingPage = await browser.newPage();
      await jobLandingPage.goto(job.jobURL);
      await jobLandingPage.waitForSelector('meta[property="og:description"]');
      job.description = await jobLandingPage.$eval(
        'meta[property="og:description"]', // Selector for the meta tag containing the description
        (element) => (element ? element.getAttribute("content") : "")
      );
      await jobLandingPage.close();
    }

    const jsonData = jobs.map((job, index) => ({
      companyName: job.companyName,
      createdAt: "",
      status: "",
      companyId: "",
      applyLink: job.jobURL,
      title: job.title,
      workStyle: job.workStyle,
      workType: job.workType,
      seniority: "",
      location: job.location,
      timing: "",
      areas: job.areas,
      images: "",
      video: "",
      audio: "",
      description: job.description,
      questions: {
        problems: "",
        traits: "",
        whyNow: "",
      },
      hiringManagerIds: "",
    }));

    return jsonData;
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

run();

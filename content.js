/**
 * Job Clipper — Content Script
 * Extracts public job listing metadata from LinkedIn, Indeed, Wellfound,
 * JSON-LD JobPosting schema, and generic pages.
 * Never fabricates missing fields or bypasses login/CAPTCHA walls.
 */
(function () {
  'use strict';

  function cleanText(str) {
    return (str || '').replace(/\s+/g, ' ').trim();
  }

  function queryText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const txt = cleanText(el.textContent);
        if (txt) return txt;
      }
    }
    return '';
  }

  function formatDateYYYYMMDD(raw) {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return cleanText(div.textContent || div.innerText || '');
  }

  function extractFromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const parsed = JSON.parse(s.textContent);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          const graph = item['@graph'] ? item['@graph'] : [item];
          for (const node of graph) {
            if (node && (node['@type'] === 'JobPosting' || (Array.isArray(node['@type']) && node['@type'].includes('JobPosting')))) {
              const title = cleanText(node.title || '');
              const company = cleanText(
                (node.hiringOrganization && (node.hiringOrganization.name || node.hiringOrganization)) || ''
              );
              let location = '';
              const jl = Array.isArray(node.jobLocation) ? node.jobLocation[0] : node.jobLocation;
              if (jl && jl.address) {
                const a = jl.address;
                location = cleanText([a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(', '));
              } else if (node.jobLocationType === 'TELECOMMUTE') {
                location = 'Remote';
              }
              const employmentType = cleanText(
                Array.isArray(node.employmentType) ? node.employmentType.join(', ') : (node.employmentType || '')
              );
              const deadline = formatDateYYYYMMDD(node.validThrough || '');
              const description = stripHtml(node.description || '').slice(0, 800);
              return { title, company, location, employmentType, deadline, description };
            }
          }
        }
      } catch (e) {}
    }
    return null;
  }

  function extractJobDetails() {
    const host = location.hostname.toLowerCase();
    const url = location.href;
    const ld = extractFromJsonLd() || {};

    let title = ld.title || '';
    let company = ld.company || '';
    let locationStr = ld.location || '';
    let employmentType = ld.employmentType || '';
    let deadline = ld.deadline || '';
    let description = ld.description || '';

    // 1. LinkedIn Public Job Listings
    if (host.includes('linkedin.com')) {
      title = title || queryText([
        '.top-card-layout__title',
        'h1.topcard__title',
        '.job-details-jobs-unified-top-card__job-title h1',
        'h1'
      ]);
      company = company || queryText([
        '.topcard__org-name-link',
        '.top-card-layout__first-subline .topcard__flavor',
        '.job-details-jobs-unified-top-card__company-name a',
        '.job-details-jobs-unified-top-card__company-name'
      ]);
      locationStr = locationStr || queryText([
        '.topcard__flavor--bullet',
        '.job-details-jobs-unified-top-card__bullet'
      ]);
      description = description || queryText([
        '.description__text',
        '.show-more-less-html__markup',
        '#job-details'
      ]).slice(0, 800);
    }
    // 2. Indeed Public Job Listings
    else if (host.includes('indeed.com')) {
      title = title || queryText([
        'h1.jobsearch-JobInfoHeader-title',
        '[data-testid="jobsearch-JobInfoHeader-title"]',
        'h1'
      ]);
      company = company || queryText([
        '[data-company-name="true"]',
        '[data-testid="inlineHeader-companyName"] a',
        '[data-testid="inlineHeader-companyName"]'
      ]);
      locationStr = locationStr || queryText([
        '[data-testid="inlineHeader-companyLocation"]',
        '[data-testid="job-location"]'
      ]);
      description = description || queryText([
        '#jobDescriptionText'
      ]).slice(0, 800);
    }
    // 3. Wellfound (AngelList) Public Job Listings
    else if (host.includes('wellfound.com') || host.includes('angel.co')) {
      title = title || queryText([
        'h1',
        '[data-test="JobTitle"]'
      ]);
      company = company || queryText([
        'a[href*="/company/"]',
        '[data-test="StartupHeader-name"]'
      ]);
      locationStr = locationStr || queryText([
        '[data-test="JobListing-location"]',
        'dd'
      ]);
      description = description || queryText([
        '[data-test="JobDescription"]',
        'main'
      ]).slice(0, 800);
    }

    // 4. Generic Fallbacks (no fabrication — only real page metadata)
    if (!title) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      title = cleanText((ogTitle && ogTitle.getAttribute('content')) || queryText(['h1']) || '');
    }
    if (!company) {
      const ogSite = document.querySelector('meta[property="og:site_name"]');
      const siteName = cleanText(ogSite && ogSite.getAttribute('content'));
      if (siteName && !['LinkedIn', 'Indeed', 'Wellfound'].includes(siteName)) {
        company = siteName;
      }
    }
    if (!description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      description = cleanText(metaDesc && metaDesc.getAttribute('content')).slice(0, 800);
    }

    return {
      title,
      company,
      url,
      deadline,
      location: locationStr,
      employmentType,
      description
    };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'EXTRACT_JOB_DETAILS') {
      sendResponse({ ok: true, data: extractJobDetails() });
      return false;
    }
    return false;
  });
})();

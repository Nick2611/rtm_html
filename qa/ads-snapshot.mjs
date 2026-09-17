// Foto del contrato Google Ads → sitio: qué URLs, anclas y filtros del catálogo usan los anuncios.
// Sólo lee (GAQL). Credenciales: ADC de gcloud + GOOGLE_ADS_DEVELOPER_TOKEN, como el resto del repo.
// Uso: node ads-snapshot.mjs [salida]   (por defecto baseline/ads.json)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CUSTOMER = '8067335472';
const LOGIN_CUSTOMER = '5059822509';
const API = `https://googleads.googleapis.com/v22/customers/${CUSTOMER}/googleAds:search`;
const out = process.argv[2] || new URL('./baseline/ads.json', import.meta.url).pathname;

const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
if (!devToken) throw new Error('Falta GOOGLE_ADS_DEVELOPER_TOKEN');
const token = execFileSync('gcloud', ['auth', 'application-default', 'print-access-token'], { encoding: 'utf8' }).trim();

async function gaql(query) {
  const rows = [];
  let pageToken;
  do {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': devToken,
        'login-customer-id': LOGIN_CUSTOMER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, pageToken }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Ads API ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
    rows.push(...(body.results || []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return rows;
}

const ads = (await gaql(`
  SELECT campaign.name, campaign.status, ad_group.id, ad_group.name, ad_group.status,
         ad_group_ad.status, ad_group_ad.ad.id, ad_group_ad.ad.final_urls, ad_group_ad.ad.final_url_suffix,
         ad_group_ad.ad.tracking_url_template
  FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED' AND campaign.status != 'REMOVED'`))
  .map(r => ({
    campaign: r.campaign.name,
    adGroup: r.adGroup.name,
    adId: r.adGroupAd.ad.id,
    // Un anuncio sirve sólo si él, su grupo y su campaña están activos.
    serving: [r.campaign.status, r.adGroup.status, r.adGroupAd.status].every(s => s === 'ENABLED'),
    finalUrls: r.adGroupAd.ad.finalUrls || [],
    finalUrlSuffix: r.adGroupAd.ad.finalUrlSuffix || '',
    trackingUrlTemplate: r.adGroupAd.ad.trackingUrlTemplate || '',
  }));

const groupLinks = (await gaql(`
  SELECT campaign.status, ad_group.name, ad_group.status, asset.id, asset.final_urls, asset.sitelink_asset.link_text
  FROM ad_group_asset
  WHERE ad_group_asset.status = 'ENABLED' AND ad_group_asset.field_type = 'SITELINK' AND campaign.status != 'REMOVED'`))
  .map(r => ({
    level: 'ad_group',
    owner: r.adGroup.name,
    serving: r.campaign.status === 'ENABLED' && r.adGroup.status === 'ENABLED',
    assetId: r.asset.id,
    text: r.asset.sitelinkAsset?.linkText || '',
    finalUrls: r.asset.finalUrls || [],
  }));

const campaignLinks = (await gaql(`
  SELECT campaign.name, campaign.status, asset.id, asset.final_urls, asset.sitelink_asset.link_text
  FROM campaign_asset
  WHERE campaign_asset.status = 'ENABLED' AND campaign_asset.field_type = 'SITELINK' AND campaign.status != 'REMOVED'`))
  .map(r => ({
    level: 'campaign',
    owner: r.campaign.name,
    serving: r.campaign.status === 'ENABLED',
    assetId: r.asset.id,
    text: r.asset.sitelinkAsset?.linkText || '',
    finalUrls: r.asset.finalUrls || [],
  }));

const [customer] = await gaql('SELECT customer.auto_tagging_enabled, customer.final_url_suffix, customer.tracking_url_template FROM customer');

const byKey = (...keys) => (a, b) => keys.map(k => String(a[k]).localeCompare(String(b[k]))).find(x => x !== 0) || 0;
const snapshot = {
  takenAt: new Date().toISOString().slice(0, 10),
  customer: {
    autoTagging: customer.customer.autoTaggingEnabled,
    finalUrlSuffix: customer.customer.finalUrlSuffix || '',
    trackingUrlTemplate: customer.customer.trackingUrlTemplate || '',
  },
  ads: ads.sort(byKey('adGroup', 'adId')),
  sitelinks: [...groupLinks, ...campaignLinks].sort(byKey('level', 'owner', 'assetId')),
};

writeFileSync(out, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`ads.json: ${snapshot.ads.length} anuncios (${snapshot.ads.filter(a => a.serving).length} sirviendo), ${snapshot.sitelinks.length} sitelinks → ${out}`);

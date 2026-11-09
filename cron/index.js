/**
 * Hourly trigger for the two production lines. GitHub's own `schedule` drops most hourly runs,
 * so this Cloudflare cron dispatches the workflows with via_cron=true; each workflow's gate still
 * decides whether a video is due this hour.
 * Secret: GH_DISPATCH_TOKEN — fine-grained PAT with "Actions: Read and write" on the shorts repo only.
 */
const REPO = 'zeynmedia/zeynmedia-shorts-factory';
const WORKFLOWS = ['shorts.yml', 'zeynel.yml', 'shorts_tr.yml'];

const dispatch = (env, workflow) =>
	fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
			accept: 'application/vnd.github+json',
			'user-agent': 'zeynmedia-cron',
			'x-github-api-version': '2022-11-28',
		},
		body: JSON.stringify({ref: 'main', inputs: {via_cron: true}}),
	});

export default {
	async scheduled(_event, env, ctx) {
		if (!env.GH_DISPATCH_TOKEN) return console.log('GH_DISPATCH_TOKEN missing');
		ctx.waitUntil(
			Promise.all(
				WORKFLOWS.map(async (w) => {
					const r = await dispatch(env, w);
					console.log(w, r.status, r.ok ? '' : await r.text());
				}),
			),
		);
	},
};

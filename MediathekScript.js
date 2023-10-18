const PLATFORM = "Sample";

var config = {};

let messageId = 10;

//Source Methods
source.enable = function(conf, settings, savedState){
	config = conf ?? {};
	throw new ScriptException("This is a sample");
}
source.getHome = async function(continuationToken) {
	const queryMessage = [
		messageId++, // Message ID for querying entries
		{
			queries: [],
			sortBy: "timestamp",
			sortOrder: "desc",
			future: true,
			offset: 0,
			size: 15
		}
	];
	if (continuationToken) {
		queryMessage[1] = continuationToken;
	}

	const socket = new WebSocket('wss://your-websocket-server.com');

	socket.send(JSON.stringify(queryMessage));

	let videoPager = null
	socket.onmessage = function(event) {
		const response = JSON.parse(event.data);

		if (response[0] >= messageId) { // Assuming response message ID is higher
			const videoEntries = response[1].result.results;
			const videos = [];

			// Process video entries and create PlatformVideo objects
			videoEntries.forEach(function(entry) {
				const video = new PlatformVideo({
					id: new PlatformID("Mediathek", entry.id, config.id),
					name: entry.title,
					uploadDate: entry.timestamp,
					duration: entry.duration,
					url: entry.url_website,
					isLive: false
				});

				videos.push(video);
			});

			// Create and return a VideoPager
			const offset = queryMessage[1].offset;
			const size = queryMessage[1].size;
			const hasMore = response[1].queryInfo.totalResults > offset + size;
			const context = { continuationToken: {...queryMessage[1], offset: offset + size} };
			videoPager = new VideoPager(videos, hasMore, context);
		}
	};

	return await new Promise(resolve => {
		const interval = setInterval(() => {
			if (videoPager) {
				resolve(videoPager);
				clearInterval(interval);
			}
		}, 10);
	});
};

source.searchSuggestions = function(query) {
	throw new ScriptException("This is a sample");
};
source.getSearchCapabilities = () => {
	return {
		types: [Type.Feed.Mixed],
		sorts: [Type.Order.Chronological],
		filters: [ ]
	};
};
source.search = function (query, type, order, filters) {
	return new ContentPager([]. false);
};
source.getSearchChannelContentsCapabilities = function () {
	return {
		types: [Type.Feed.Mixed],
		sorts: [Type.Order.Chronological],
		filters: []
	};
};
source.searchChannelContents = function (channelUrl, query, type, order, filters) {
	throw new ScriptException("This is a sample");
};

source.searchChannels = function (query) {
	throw new ScriptException("This is a sample");
};

//Channel
source.isChannelUrl = function(url) {
	throw new ScriptException("This is a sample");
};
source.getChannel = function(url) {
	throw new ScriptException("This is a sample");
};
source.getChannelContents = function(url) {
	throw new ScriptException("This is a sample");
};

//Video
source.isContentDetailsUrl = function(url) {
	throw new ScriptException("This is a sample");
};
source.getContentDetails = function(url) {
	throw new ScriptException("This is a sample");
};

//Comments
source.getComments = function (url) {
	throw new ScriptException("This is a sample");

}
source.getSubComments = function (comment) {
	throw new ScriptException("This is a sample");
}

log("LOADED");
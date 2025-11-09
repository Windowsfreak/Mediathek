// =============================================================================
// CONSTANTS
// =============================================================================

const PLATFORM = "MediathekView";

const API_URL = 'https://mediathekviewweb.de/api/query';
const API_HEADERS = { 'Content-Type': 'application/json' };

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT_BY = 'timestamp';
const DEFAULT_SORT_ORDER = 'desc';
const DEFAULT_FUTURE = false;
const DEFAULT_OFFSET = 0;

const BROADCASTER_DOMAINS = [
    'ardmediathek.de',
    'zdf.de',
    'phoenix.de',
    'br.de',
    'mdr.de',
    'ndr.de',
    'wdr.de',
    'swr.de',
    'hr-fernsehen.de',
    'rbb-online.de',
    'sr-online.de',
    'daserste.de',
    'tagesschau.de',
    'sportschau.de',
    'orf.at',
    'on.orf.at',
    'arte.tv',
    '3sat.de',
    'kika.de',
    'funk.net'
];

// =============================================================================
// REGEX PATTERNS
// =============================================================================

const REGEX_VIDEO_FILE = /\.(mp4|webm)/i;
const REGEX_HLS_FILE = /\.m3u8/i;
const REGEX_WEBM_FILE = /\.webm/i;
const REGEX_MEDIA_FILE = /\.(m3u8|mp4)(\?|$)/;

const REGEX_MEDIATHEK_DOMAIN = /mediathekviewweb\.de/;
const REGEX_CHANNEL_PATH = /\/(c|channel)\//;
const REGEX_CHANNEL_URL = /\/(c|channel)\/([^\/\?]+)/;
const REGEX_CHANNEL_HINT = /isMediathekChannel=1/; // Query parameter added to plugin-generated channel URLs for quick identification
const REGEX_CONTENT_HINT = /isMediathekContent=1/; // Query parameter added to plugin-generated content URLs for quick identification

const REGEX_PROTOCOL = /^https?:\/\//;
const REGEX_PATH_QUERY = /[\/\?#].*$/;
const REGEX_SLUG_SEPARATOR = /[-_]/g;

let config = {};

// =============================================================================
// SOURCE METHODS
// =============================================================================

/**
 * Enables the plugin with configuration
 * @param {object} conf - Plugin configuration from MediathekConfig.json
 * @param {object} settings - User settings
 * @param {object} savedState - Previously saved state
 */
source.enable = function (conf, settings, savedState) {
    config = conf ?? {};
};

/**
 * Gets the home feed with latest videos
 * @returns {MediathekVideoPager} Pager with latest videos
 */
source.getHome = function () {
    return getMediathekVideoPager({
        queries: [],
        sortBy: DEFAULT_SORT_BY,
        sortOrder: DEFAULT_SORT_ORDER,
        future: DEFAULT_FUTURE,
        offset: DEFAULT_OFFSET,
        size: DEFAULT_PAGE_SIZE
    });
};

/**
 * Gets search suggestions for a query
 * @param {string} query - Search query
 * @returns {string[]} Array of suggestions (currently empty)
 */
source.searchSuggestions = function (query) {
    return [];
};

/**
 * Gets the search capabilities
 * @returns {object} Search capabilities configuration
 */
source.getSearchCapabilities = () => ({
    types: [Type.Feed.Mixed],
    sorts: [Type.Order.Chronological],
    filters: []
});

/**
 * Searches for videos matching the query
 * @param {string} query - Search query
 * @param {string} type - Content type
 * @param {string} order - Sort order
 * @param {object} filters - Search filters
 * @returns {MediathekVideoPager} Pager with search results
 */
source.search = function (query, type, order, filters) {
    const queries = [{
        fields: ['title', 'topic', 'channel', 'description'],
        query: query
    }];

    return getMediathekVideoPager({
        queries,
        sortBy: DEFAULT_SORT_BY,
        sortOrder: DEFAULT_SORT_ORDER,
        future: DEFAULT_FUTURE,
        offset: DEFAULT_OFFSET,
        size: DEFAULT_PAGE_SIZE
    });
};

/**
 * Gets channel content search capabilities
 * @returns {object} Search capabilities for channel contents
 */
source.getSearchChannelContentsCapabilities = function () {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

/**
 * Searches within a specific channel's contents
 * @param {string} channelUrl - Channel URL
 * @param {string} query - Search query
 * @param {string} type - Content type
 * @param {string} order - Sort order
 * @param {object} filters - Search filters
 * @returns {MediathekVideoPager} Pager with filtered channel videos
 */
source.searchChannelContents = function (channelUrl, query, type, order, filters) {
    const channelId = REGEX_CHANNEL_URL.exec(channelUrl)?.[2];

    if (!channelId || !query) {
        return new VideoPager([], false, {});
    }

    const topicName = decodeURIComponent(channelId);
    const queries = [
        { fields: ['topic'], query: topicName },
        { fields: ['title', 'description'], query: query }
    ];

    return getMediathekVideoPager({
        queries,
        sortBy: DEFAULT_SORT_BY,
        sortOrder: DEFAULT_SORT_ORDER,
        future: DEFAULT_FUTURE,
        offset: DEFAULT_OFFSET,
        size: DEFAULT_PAGE_SIZE
    });
};

/**
 * Searches for channels matching the query
 * @param {string} query - Search query
 * @returns {ChannelPager} Empty pager (channel search not implemented)
 */
source.searchChannels = function (query) {
    return new ChannelPager([], false, {});
};

/**
 * Checks if a URL is a channel URL
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is a channel URL
 */
source.isChannelUrl = function (url) {
    if (!url) return false;

    if (REGEX_CHANNEL_HINT.test(url)) {
        return true;
    }

    if (REGEX_MEDIATHEK_DOMAIN.test(url) && REGEX_CHANNEL_PATH.test(url)) {
        return true;
    }

    return false;
};

/**
 * Gets channel information from URL
 * @param {string} url - Channel URL
 * @returns {PlatformChannel} Channel object
 * @throws {ScriptException} If URL is invalid
 */
source.getChannel = function (url) {
    if (!url) {
        throw new ScriptException('URL is required');
    }

    const match = REGEX_CHANNEL_URL.exec(url);
    const channelId = match ? match[2] : null;

    if (!channelId) {
        const fallbackId = url.replace(REGEX_PROTOCOL, '').replace(REGEX_PATH_QUERY, '');
        if (fallbackId) {
            return new PlatformChannel({
                id: new PlatformID(PLATFORM, fallbackId, config.id),
                name: decodeURIComponent(fallbackId),
                thumbnail: '',
                banner: '',
                subscribers: 0,
                description: 'MediathekView channel: ' + decodeURIComponent(fallbackId),
                url: url,
                links: {}
            });
        }
        throw new ScriptException('Invalid channel URL');
    }

    return new PlatformChannel({
        id: new PlatformID(PLATFORM, channelId, config.id),
        name: decodeURIComponent(channelId),
        thumbnail: '',
        banner: '',
        subscribers: 0,
        description: 'MediathekView channel: ' + decodeURIComponent(channelId),
        url: url,
        links: {}
    });
};

/**
 * Gets all videos from a channel
 * @param {string} url - Channel URL
 * @returns {MediathekVideoPager} Pager with channel videos
 */
source.getChannelContents = function (url) {
    const channelId = REGEX_CHANNEL_URL.exec(url)?.[2];

    if (!channelId) {
        return new VideoPager([], false, {});
    }

    const topicName = decodeURIComponent(channelId);
    const queries = [{ fields: ['topic'], query: topicName }];

    return getMediathekVideoPager({
        queries,
        sortBy: DEFAULT_SORT_BY,
        sortOrder: DEFAULT_SORT_ORDER,
        future: DEFAULT_FUTURE,
        offset: DEFAULT_OFFSET,
        size: DEFAULT_PAGE_SIZE
    });
};

/**
 * Checks if a URL is a content details URL
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is a content URL
 */
source.isContentDetailsUrl = function (url) {
    if (!url) return false;

    if (REGEX_CONTENT_HINT.test(url)) {
        return true;
    }

    if (REGEX_MEDIA_FILE.test(url)) {
        return true;
    }

    if (isValidBroadcasterUrl(url)) {
        return true;
    }

    if (REGEX_MEDIATHEK_DOMAIN.test(url)) {
        return false;
    }

    return false;
};

/**
 * Gets detailed information about a video from its URL
 * @param {string} url - Video URL
 * @returns {PlatformVideoDetails} Detailed video information
 * @throws {UnavailableException} If content is not found
 */
source.getContentDetails = function (url) {
    // Try exact URL match first
    try {
        const exactJson = apiQuery({
            queries: [{
                fields: ['url_website'],
                query: url
            }],
            sortBy: DEFAULT_SORT_BY,
            sortOrder: DEFAULT_SORT_ORDER,
            future: DEFAULT_FUTURE,
            offset: DEFAULT_OFFSET,
            size: 1
        });
        const exactEntry = exactJson?.result?.results?.[0];

        if (exactEntry && exactEntry.url_website === url) {
            return entryToDetails({ entry: exactEntry, url });
        }
    } catch (e) {
        log('Exact URL match failed: ' + e);
    }

    // Fallback: Try fuzzy search
    try {
        const json = apiQuery({
            queries: [{
                fields: ['url_website', 'title', 'description'],
                query: url
            }],
            sortBy: DEFAULT_SORT_BY,
            sortOrder: DEFAULT_SORT_ORDER,
            future: true,
            offset: DEFAULT_OFFSET,
            size: 3
        });
        const results = json?.result?.results || [];

        for (const entry of results) {
            if (entry.url_website === url || entry.url_website?.includes(url) || url.includes(entry.url_website || '')) {
                return entryToDetails({ entry, url });
            }
        }

        if (results.length > 0) {
            return entryToDetails({ entry: results[0], url });
        }
    } catch (e) {
        log('Fuzzy search failed: ' + e);
    }

    // Last resort: search by title extracted from URL
    const slug = (url.split('/').pop() || '').split('?')[0].replace(REGEX_SLUG_SEPARATOR, ' ');
    if (slug && slug.length > 3) {
        try {
            const json2 = apiQuery({
                queries: [{
                    fields: ['title'],
                    query: slug
                }],
                sortBy: DEFAULT_SORT_BY,
                sortOrder: DEFAULT_SORT_ORDER,
                future: true,
                offset: DEFAULT_OFFSET,
                size: 1
            });
            const entry2 = json2?.result?.results?.[0];
            if (entry2) return entryToDetails({ entry: entry2, url });
        } catch (e) {
            log('Title search failed: ' + e);
        }
    }

    throw new UnavailableException('Content not found in MediathekView database. Try opening the broadcaster\'s website directly: ' + url);
};

/**
 * Gets comments for a video
 * @param {string} url - Video URL
 * @returns {CommentPager} Empty pager (comments not supported)
 */
source.getComments = function (url) {
    return new CommentPager([], false, {});
};

/**
 * Gets replies to a comment
 * @param {object} comment - Parent comment
 * @returns {CommentPager} Empty pager (comments not supported)
 */
source.getSubComments = function (comment) {
    return new CommentPager([], false, {});
};

// =============================================================================
// PAGER CLASSES
// =============================================================================

/**
 * Custom video pager for MediathekView with pagination support
 */
class MediathekVideoPager extends VideoPager {
    constructor(results, hasMore, { queries, sortBy, sortOrder, future, offset, size }) {
        super(results, hasMore, { queries, sortBy, sortOrder, future, offset, size });
    }

    nextPage() {
        const nextOffset = this.context.offset + this.context.size;
        return getMediathekVideoPager({
            queries: this.context.queries,
            sortBy: this.context.sortBy,
            sortOrder: this.context.sortOrder,
            future: this.context.future,
            offset: nextOffset,
            size: this.context.size
        });
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Makes a query to the MediathekView API
 * @param {object} body - Request body with queries and parameters
 * @returns {object} Parsed API response
 * @throws {ScriptException} On API errors
 */
function apiQuery(body) {
    const resp = http.POST(API_URL, JSON.stringify(body), API_HEADERS);
    if (resp.code !== 200) {
        throw new ScriptException('API error ' + resp.code + ': ' + resp.body);
    }
    return JSON.parse(resp.body);
}

/**
 * Safely converts a value to an integer
 * @param {*} x - Value to convert
 * @returns {number} Integer value or 0
 */
function toInt(x) {
    try {
        return parseInt(x ?? 0) || 0;
    } catch {
        return 0;
    }
}

/**
 * Safely adds a query parameter to a URL
 * @param {string} url - URL to add parameter to
 * @param {string} key - Parameter key
 * @param {string} value - Parameter value
 * @returns {string} URL with added parameter, or original URL if invalid
 */
function addUrlParam(url, key, value) {
    if (!url) return url;
    try {
        const urlObj = new URL(url);
        urlObj.searchParams.set(key, value);
        return urlObj.toString();
    } catch (e) {
        // If URL parsing fails, fall back to string concatenation
        return url + (url.includes('?') ? '&' : '?') + key + '=' + value;
    }
}

/**
 * Custom video pager for MediathekView with pagination support
 * @param {PlatformVideo[]} results - Array of videos
 * @param {boolean} hasMore - Whether more pages are available
 * @param {object} context - Pagination context
 * @param {Array} context.queries - Search queries
 * @param {string} context.sortBy - Sort field
 * @param {string} context.sortOrder - Sort order
 * @param {boolean} context.future - Include future content
 * @param {number} context.offset - Current offset
 * @param {number} context.size - Page size
 */
function getMediathekVideoPager({ queries, sortBy, sortOrder, future, offset, size }) {
    const json = apiQuery({ queries, sortBy, sortOrder, future, offset, size });

    const results = json?.result?.results || [];
    const total = json?.result?.queryInfo?.totalResults || 0;

    // Filter out videos with timestamps in the future (later today)
    const now = Math.floor(Date.now() / 1000);
    const filteredResults = results.filter(r => (r.timestamp || 0) <= now);

    const videos = resultsToPlatformVideos(filteredResults);
    const hasMore = offset + size < total;

    return new MediathekVideoPager(videos, hasMore, { queries, sortBy, sortOrder, future, offset, size });
}

/**
 * Converts API results to PlatformVideo objects
 * @param {Array} results - Array of API result entries
 * @returns {PlatformVideo[]} Array of platform videos
 */
function resultsToPlatformVideos(results) {
    return (results || []).map((e) => {
        const channelName = e.topic || e.channel || 'MediathekView';
        const channelId = encodeURIComponent(channelName);
        const channelUrl = addUrlParam(`https://mediathekviewweb.de/c/${channelId}`, 'isMediathekChannel', '1');
        const idVal = (e._id ? String(e._id) : (e.url_website || e.url_video || e.id || e.title || ''));
        
        // Add content hint to video URLs from API (not broadcaster URLs)
        let videoUrl = e.url_website || e.url_video || '';
        if (videoUrl && !isValidBroadcasterUrl(videoUrl)) {
            videoUrl = addUrlParam(videoUrl, 'isMediathekContent', '1');
        }

        return new PlatformVideo({
            id: new PlatformID(PLATFORM, idVal, config.id),
            name: e.title || e.topic || e.filename || '',
            thumbnails: new Thumbnails([new Thumbnail('', 0)]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, channelName, config.id),
                channelName,
                channelUrl,
                ''
            ),
            uploadDate: toInt(e.timestamp || e.time),
            url: videoUrl,
            duration: toInt(e.duration),
            isLive: false,
        });
    });
}

/**
 * Checks if a URL is from a valid German broadcaster
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is from a known broadcaster
 */
function isValidBroadcasterUrl(url) {
    if (!url) return false;
    try {
        const urlObj = new URL(url);
        const host = urlObj.hostname.toLowerCase();
        return BROADCASTER_DOMAINS.some(domain => host === domain || host.endsWith('.' + domain));
    } catch (e) {
        return false;
    }
}

/**
 * Converts a MediathekView entry to PlatformVideoDetails
 * @param {object} params - Parameters
 * @param {object} params.entry - MediathekView entry
 * @param {string} params.url - Video URL
 * @returns {PlatformVideoDetails} Detailed video information
 */
function entryToDetails({ entry, url }) {
    const sources = [];
    const subtitles = [];
    const dur = toInt(entry?.duration);

    const cands = [
        { key: 'url_video', name: 'SD', priority: false },
        { key: 'url_video_hd', name: 'HD', priority: true },
        { key: 'url_video_low', name: 'Low', priority: false },
    ];

    for (const c of cands) {
        const u = entry?.[c.key];
        if (!u) continue;

        try {
            if (REGEX_HLS_FILE.test(u)) {
                sources.push(new HLSSource({
                    name: c.name,
                    duration: dur,
                    url: u,
                    priority: c.priority
                }));
            } else if (REGEX_VIDEO_FILE.test(u)) {
                sources.push(new VideoUrlSource({
                    name: c.name,
                    duration: dur,
                    url: u,
                    container: REGEX_WEBM_FILE.test(u) ? 'video/webm' : 'video/mp4',
                    priority: c.priority
                }));
            }
        } catch (e) {
            log('Error adding video source: ' + e);
        }
    }

    // Fallback if no sources from entry but we have a direct URL
    if (!sources.length && url) {
        if (REGEX_HLS_FILE.test(url)) {
            sources.push(new HLSSource({ name: 'Stream', duration: dur, url }));
        } else if (REGEX_VIDEO_FILE.test(url)) {
            sources.push(new VideoUrlSource({
                name: 'Video',
                duration: dur,
                url,
                container: REGEX_WEBM_FILE.test(url) ? 'video/webm' : 'video/mp4'
            }));
        }
    }

    // Add subtitles if available
    if (entry?.url_subtitle) {
        try {
            subtitles.push({
                name: 'German',
                url: entry.url_subtitle,
                format: 'text/vtt',
                autoGenerated: false
            });
        } catch (e) {
            log('Error adding subtitles: ' + e);
        }
    }

    const channelName = entry?.topic || entry?.channel || 'MediathekView';
    const channelId = encodeURIComponent(channelName);
    const channelUrl = addUrlParam(`https://mediathekviewweb.de/c/${channelId}`, 'isMediathekChannel', '1');

    return new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, entry?._id ? String(entry._id) : (entry?.url_website || entry?.url_video || entry?.title || url), config.id),
        name: entry?.title || entry?.topic || '',
        thumbnails: new Thumbnails([new Thumbnail('', 0)]),
        author: new PlatformAuthorLink(new PlatformID(PLATFORM, channelName, config.id), channelName, channelUrl, ''),
        uploadDate: toInt(entry?.timestamp),
        duration: dur,
        viewCount: 0,
        url: entry?.url_website || url || '',
        isLive: false,
        description: entry?.description || '',
        video: new VideoSourceDescriptor(sources),
        subtitles: subtitles
    });
}

log('loaded');
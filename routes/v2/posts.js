'use strict';

var posts = require.main.require('./src/posts');
var apiMiddleware = require('./middleware');
var errorHandler = require('../../lib/errorHandler');
var utils = require('./utils');


module.exports = function () {
	var app = require('express').Router();

	app.route('/:pid')
		.put(apiMiddleware.requireUser, function (req, res) {
			if (!utils.checkRequired(['content'], req, res)) {
				return false;
			}

			var payload = {
				uid: req.user.uid,
				pid: req.params.pid,
				content: req.body.content,
				options: {},
			};

			if (req.body.handle) { payload.handle = req.body.handle; }
			if (req.body.title) { payload.title = req.body.title; }
			if (req.body.topic_thumb) { payload.topic_thumb = req.body.topic_thumb; }
			if (req.body.tags) { payload.tags = req.body.tags; }

			posts.edit(payload, function (err) {
				errorHandler.handle(err, res);
			});
		})
		.delete(apiMiddleware.requireUser, apiMiddleware.validatePid, function (req, res) {
			posts.purge(req.params.pid, req.user.uid, function (err) {
				errorHandler.handle(err, res);
			});
		});

	app.route('/:pid/state')
		.put(apiMiddleware.requireUser, apiMiddleware.validatePid, function (req, res) {
			posts.restore(req.params.pid, req.user.uid, function (err) {
				errorHandler.handle(err, res);
			});
		})
		.delete(apiMiddleware.requireUser, apiMiddleware.validatePid, function (req, res) {
			posts.delete(req.params.pid, req.user.uid, function (err) {
				errorHandler.handle(err, res);
			});
		});

	app.route('/:pid/vote')
		.post(apiMiddleware.requireUser, function (req, res) {
			if (!utils.checkRequired(['delta'], req, res)) {
				return false;
			}

			if (req.body.delta > 0) {
				posts.upvote(req.params.pid, req.user.uid, function (err, data) {
					errorHandler.handle(err, res, data);
				});
			} else if (req.body.delta < 0) {
				posts.downvote(req.params.pid, req.user.uid, function (err, data) {
					errorHandler.handle(err, res, data);
				});
			} else {
				posts.unvote(req.params.pid, req.user.uid, function (err, data) {
					errorHandler.handle(err, res, data);
				});
			}
		})
		.delete(apiMiddleware.requireUser, function (req, res) {
			posts.unvote(req.params.pid, req.user.uid, function (err, data) {
				errorHandler.handle(err, res, data);
			});
		});

	app.route('/:pid/bookmark')
		.post(apiMiddleware.requireUser, async function (req, res) {
			try {
				// Ensure user context
				const uid = req.user?.uid || req.uid;
				if (!uid || uid <= 0) {
					return errorHandler.respond(401, res);
				}
				
				// Check if post exists and user can access it
				const topics = require.main.require('./src/topics');
				const privileges = require.main.require('./src/privileges');
				
				const postData = await posts.getPostFields(req.params.pid, ['pid', 'tid']);
				if (!postData || !postData.pid) {
					return errorHandler.respond(404, res);
				}
				
				// Check topic/category permissions
				const topicData = await topics.getTopicFields(postData.tid, ['cid']);
				const canRead = await privileges.categories.can('topics:read', topicData.cid, uid);
				if (!canRead) {
					return errorHandler.respond(403, res);
				}
				
				// Perform bookmark
				await posts.bookmark(req.params.pid, uid);
				return res.json({ status: 'ok', bookmarked: true });
			} catch (error) {
				errorHandler.handle(error, res);
			}
		})
		.delete(apiMiddleware.requireUser, async function (req, res) {
			try {
				const uid = req.user?.uid || req.uid;
				if (!uid || uid <= 0) {
					return errorHandler.respond(401, res);
				}
				
				await posts.unbookmark(req.params.pid, uid);
				return res.json({ status: 'ok', bookmarked: false });
			} catch (error) {
				errorHandler.handle(error, res);
			}
		});

	return app;
};

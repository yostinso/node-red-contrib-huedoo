module.exports = function(RED)
{
	"use strict";

	function HueMagic(config)
	{
		RED.nodes.createNode(this, config);

		const scope = this;
		const async = require('async');
		const isEndless = config.endless;
		const restoreState = config.restore;

		// STEPS INITIALIZATION
		this.steps = config.steps;
		this.randomOrder = false;

		//
		// STATUS CHECK
		this.nodeActive = true;
		this.isAnimating = false;
		this.firstRun = false;

		//
		// INITIALIZE STATUS
		if(this.steps == null)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-magic.node.no-animation"});
		}
		else
		{
			this.status({fill: "grey", shape: "dot", text: "hue-magic.node.stopped"});
		}

		//
		// HELPER
		this.delay = function(ms)
		{
			return function (callback)
			{
				if(scope.isAnimating == true)
				{
					setTimeout(function(){ callback(); }, ms);
				}
				else
				{
					callback(true);
				}
			}
		}

		this.shuffleOrder = function(a)
        {
            var j, x, i;
            for (i = a.length - 1; i > 0; i--)
            {
                j = Math.floor(Math.random() * (i + 1));
                x = a[i];
                a[i] = a[j];
                a[j] = x;
            }
            return a;
        }

		//
		// SET START STATUS
		this.animationStarted = function()
		{
			return function (callback)
			{
				var message = {};
				message.animation = {};
				message.animation.status = true;
				message.animation.restore = restoreState;

				scope.send(message);
				callback();
			}
		}

		//
		// SET STOP STATUS
		this.animationStopped = function(done)
		{
			var message = {};
			message.animation = {};
			message.animation.status = false;
			message.animation.restore = restoreState;

			scope.send(message);
			if (done) { done(); }
		}

		//
		// SEND ANIMATIONS STEP BY STEP
		this.step = function(step)
		{
			return function (callback)
			{
				if(scope.isAnimating == true)
				{
					var message = {};
					message.payload = step;
					message.payload.on = true;

					scope.send(message);

					if(typeof step.transitionTime != 'undefined')
					{
						setTimeout(function(){ callback(); }, parseFloat(step.transitionTime)*1000);
					}
					else
					{
						setTimeout(function(){ callback(); }, 200);
					}
				}
				else
				{
					callback(true);
				}
			}
		}

		//
		// PREPARE ANIMATION STEPS
		this.prepareAnimationSteps = function(stepsParsed)
		{
			var aSteps = [];

			// ANIMATION STARTED (LET DEVICES KNOW)
			if(scope.firstRun == false)
			{
				aSteps.push(scope.animationStarted());
				scope.firstRun = true;
			}

			// PUSH ANIMATIONS WITH DELAYS
			for (var i in stepsParsed)
			{
				var aStep = stepsParsed[i];
				aSteps.push(scope.delay(aStep.delay));
				aSteps.push(scope.step(aStep.animation));
			}

			return aSteps;
		}

		//
		// START / STOP ANIMATION
		this.animate = function(animationSteps, send, done)
		{
			var animation = scope.prepareAnimationSteps(animationSteps);

			// ANIMATE
			async.waterfall(animation, function(stopped, animated)
			{
				if(stopped)
				{
					return false;
				}

				// ENDLESS?
				if(isEndless == true && scope.nodeActive == true && scope.isAnimating == true)
				{
					// SHUFFLE ANIMATION IF RANDOM ORDER
					if(scope.randomOrder == true)
					{
						animationSteps = scope.shuffleOrder(animationSteps);
					}

					// RESTART
					scope.animate(animationSteps, send, done);
				}
				else
				{
					scope.animationStopped(done);
					scope.isAnimating = false;

					scope.status({fill: "grey", shape: "dot", text: "hue-magic.node.stopped"});
				}
			});
		}

		//
		// START THE HUEMAGIC ANIMATION
		this.on('input', function(msg, send, done)
		{
			// REDEFINE SEND AND DONE IF NOT AVAILABLE
			send = send || function() { scope.send.apply(scope,arguments); }
			done = done || function() { scope.done.apply(scope,arguments); }
			
			if(typeof msg.payload != 'undefined' && typeof msg.payload.steps != 'undefined')
			{
				scope.steps = msg.payload.steps;
				msg.payload.animate = true;
			}

			const playFromButton = (typeof msg.__user_inject_props__ != 'undefined' && msg.__user_inject_props__ == "play");

			if(scope.steps != null)
			{
				// SPECIALS CONFIG
				if(typeof msg.payload != 'undefined' && typeof msg.payload.specials != 'undefined')
				{
					// APPLY RANDOM ORDER CONFIG
					if(typeof msg.payload.specials.randomOrder != 'undefined')
					{
						scope.randomOrder = msg.payload.specials.randomOrder;
					}
				}

				// TURN ON ANIMATION
				if(typeof msg.payload != 'undefined' && msg.payload.animate == true||msg.payload === true||playFromButton === true)
				{
					var animationSteps = typeof scope.steps === 'string' ? JSON.parse(scope.steps) : scope.steps;
					if(scope.isAnimating == false)
					{
						scope.status({fill: "green", shape: "dot", text: "hue-magic.node.animating"});

						scope.isAnimating = true;
						scope.animate(animationSteps, send, done);
					}
				}

				// TURN OFF ANIMATION
				if((typeof msg.payload != 'undefined' && typeof msg.payload.animate != 'undefined' && msg.payload.animate == false)||msg.payload === false)
				{
					scope.animationStopped(done);
					scope.isAnimating = false;

					scope.status({fill: "grey", shape: "dot", text: "hue-magic.node.stopped"});
				}
			}
			else
			{
				// NO ANIMATION SPECIFIED
				this.status({fill: "red", shape: "ring", text: "hue-magic.node.no-animation"});
				if(done) { done(); }
			}
		});

		//
		// CLOSE NODE / REMOVE ANIMATION
		this.on('close', function()
		{
			scope.nodeActive = false;
		});
	}

	RED.nodes.registerType("hue-magic", HueMagic);

	//
	// GET ANIMATIONS
	RED.httpAdmin.get('/hue/animations', function(req, res, next)
	{
		const fs = require("fs");
		const path = require("path");
		const dir = path.resolve(__dirname, 'animations');

		var allAnimations = [];
		fs.readdirSync(dir).forEach(function(filename)
		{
			try
			{
				var filepath = path.resolve(dir, filename);
				var stat = fs.statSync(filepath);
				var isFile = stat.isFile();
				var fileID = path.basename(filepath, '.json');

				if(isFile)
				{
					var animation = JSON.parse(fs.readFileSync(filepath, "utf8"));
					animation.info.id = fileID;

					allAnimations.push(animation);
				};
			}
			catch(e)
			{
				console.log(fileID, e);
			}
		});

		// SEND ALL ANIMATIONS
		res.end(JSON.stringify(allAnimations));
	});

	//
	// GET ANIMATION PREVIEWS
	RED.httpAdmin.get('/hue/animations/:file', function(req, res, next)
	{
		let path = require("path");
		res.sendFile(req.params.file, {
			root: path.resolve(__dirname, 'animations', 'previews'),
			dotfiles: 'deny'
		});
	});

	//
	// GET ASSETS
	RED.httpAdmin.get('/hue/assets/:file', function(req, res, next)
	{
		let path = require("path");
		res.sendFile(req.params.file, {
			root: path.resolve(__dirname, 'assets'),
			dotfiles: 'deny'
		});
	});
}
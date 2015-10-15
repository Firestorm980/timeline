(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {

    var pluginDefaultTemplate = function( event_data ){
        var event_HTML_array = ['<div>','<p>', event_data.data.content, '</p>','</div>'];
        var event_HTML = event_HTML_array.join('\n');

        return event_HTML;
    };

    // Create the defaults once
    var pluginName = "timeline",
        defaults = {
            events: [], // JSON array of events.
            template: pluginDefaultTemplate, // Template to use to render event. function?
            vertical: false, // Orientation
            speed: 1000, // Animation
            directionNav: true, // Previous / Next navigation
            directionNavContainer: null, // Selector for nav to be built in
            directionNextText: 'Next',
            directionPreviousText: 'Previous',
            eventNav: true, // Single event nav (dots)
            eventNavBranch: 'master',
            eventNavContainer: null, // Selector for nav to be built in
            keyboard: true, // Bind keyboard arrow keys
            continuePast: false, // Add styles to 'extend' tl
            continueFuture: false,
            startAt: null, // Accepts a Date object and tries to 'start' the tl at that position
            zoom: 1,
        },
        frame = false;

    // The actual plugin constructor
    function Plugin( element, options ) {
    	base = this;
        base.element = element;

        // jQuery has an extend method that merges the
        // contents of two or more objects, storing the
        // result in the first object. The first object
        // is generally empty because we don't want to alter
        // the default options for future instances of the plugin
        base.settings = $.extend( {}, defaults, options) ;

        base._defaults = defaults;
        base._name = pluginName;

        base._data = {};

        base._init();


    }

    $.extend(Plugin.prototype, {

        _init: function() {
            var instance = this;

            if ( instance.settings.events.length < 1 ){
                console.error('No events in array.');
                return false;
            }

            instance._setRAF.call(instance);

            // Set up events, branches, timelines, extremes
            instance._setAll.call(instance);
            // Make the base HTML
            instance._construct.call(instance);

            instance._contructEvents.call(instance);
            // Make the navigation for next/previous
            if ( instance.settings.directionNav ){
                instance._constructDirectionNav.call(this);
            }
            // Make the event navigation
            if ( instance.settings.eventNav ){
                instance._constructEventNav.call(this);
            }


            instance._bindEvents.call(this);
        },

        _construct: function(){
            var instance = this;
            var element = instance.element;
            var $element = jQuery(element);
            var zoom = instance.settings.zoom * 100;
            var HTML_array = ['<div class="tl__scroller">','<div class="tl__branches" style="width: '+zoom+'%;">'];
            var direction_class = ( !instance.settings.vertical ) ? 'tl--horizontal' : 'tl--vertical';
            var branches_HTML = instance._constructBranches.call(this);

            HTML_array.push(branches_HTML);

            HTML_array = HTML_array.concat(['</div>','</div>']);
            HTML = HTML_array.join('\n');

            $element.addClass('tl').addClass(direction_class).html(HTML);
        },
        _constructBranches: function(){
            var instance = this;
            var branches = instance._data.branches;
            var timelines = instance._data.timelines;
            var is_horizontal = ( !instance.settings.vertical );
            var start_date = instance._data.oldest;
            var end_date = instance._data.newest;
            var branches_HTML_array = [];
            var branches_HTML = '';

            for (var i = 0; i < branches.length; i++) {
                var branch_name = branches[i];
                var branch_start_date = timelines[ branch_name ].oldest;
                var branch_end_date = timelines[ branch_name ].newest;

                // How much should this be offset in percentage? (left/top)
                var branch_offset = ( branch_start_date - start_date ) / ( end_date - start_date ) * 100;
                // How long should the branch be? (width/height)
                var branch_length = ( branch_end_date - branch_start_date ) / ( end_date - start_date ) * 100;

                var branch_style = ( is_horizontal ) ? 'margin-left: '+branch_offset+'%; width: '+branch_length+'%' : 'margin-top: '+branch_offset+'%; height: '+branch_length+'%';

                var branch_HTML = ['<div class="tl__branch tl__'+branch_name+'" data-tl-branch="'+branch_name+'" style="'+branch_style+'" data-tl-offset="'+branch_offset+'" data-tl-length="'+branch_length+'">','<span class="tl__line"></span>','<span class="tl__line tl__line-active"></span>','<ul class="tl__events">','</ul>','</div>'];

                branches_HTML_array = branches_HTML_array.concat( branch_HTML );
            }

            branches_HTML = branches_HTML_array.join('\n');

            return branches_HTML;
        },
        _constructDirectionNav: function(){
            var instance = this;
            var element = instance.element;
            var $element = jQuery(element);
            var settings = instance.settings;
            var directionNavContainer = instance.settings.directionNavContainer;
            var HTML_array = ['<div class="tl__direction-nav">','<button type="button" class="btn btn--tl tl__previous">', instance.settings.directionPreviousText,'</button>','<button type="button" class="btn btn--tl tl__next">',instance.settings.directionNextText,'</button>','</div>'];
            var HTML = HTML_array.join('\n');

            if ( directionNavContainer !== null && jQuery(directionNavContainer).length ){
                jQuery(directionNavContainer).append(HTML);
            }
            else {
                $element.append(HTML);
            }
        },
        _constructEventNav: function(){
            var instance = this;
            var element = instance.element;
            var $element = jQuery(element);
            var settings = instance.settings;
            var eventNavContainer = settings.eventNavContainer;
            var eventNavBranch = settings.eventNavBranch;
            var HTML_array = ['<ul class="tl__event-nav">'];
            var HTML = '';
            var events = instance._data.timelines[eventNavBranch].events; // Get the particular branch's timeline events

            // Loop through branch events
            for (var i = 0; i < events.length; i++) {
                var event_object = events[i];
                var event_HTML = ['<li class="tl__event-nav-item">','<button type="button" class="btn btn--tl-event-nav tl__event-nav-btn" data-tl-event-index="'+i+'" data-tl-event-branch="'+eventNavBranch+'">','</button>','</li>'];
                // Add event navigation
                // The index should tell us what the button will "link" to
                // The branch will tell us what timeline we're looking at
                HTML_array = HTML_array.concat(event_HTML);
            }

            HTML_array.push('</ul>');
            HTML = HTML_array.join('\n');

            if ( eventNavContainer !== null && jQuery(eventNavContainer).length ){
                jQuery(eventNavContainer).append(HTML);
            }
            else {
                $element.append(HTML);
            }
        },
        _contructEvents: function(){
            var instance = this;
            var element = instance.element;
            var $element = jQuery(element);
            var timelines = instance._data.timelines;

            for (var key in timelines){
                var HTML = '';
                var timeline = timelines[key];
                var events = timeline.events;
                var $timeline = $element.find('[data-tl-branch="'+key+'"]');
                var $events = $timeline.find('.tl__events');

                for (var i = 0; i < events.length; i++) {
                    var event_data = events[i];
                    var event_HTML = instance._tlEvent.create.call( this, event_data, i );

                    HTML += event_HTML;
                }

                $events.append(HTML);
            }
        },

        _getMinMaxDates: function( events ){
            var event_dates = [];
            var oldest_event = 0;
            var newest_event = 0;

            // Loop through all events
            for (var i = events.length - 1; i >= 0; i--) {
                var event_object = events[i];
                var event_date = event_object.date.getTime();
                // Push the date in milliseconds
                event_dates.push( event_date );
            }
            // Get the extremes
            oldest_date = Math.min.apply(this, event_dates );
            newest_date = Math.max.apply(this, event_dates );

            return { oldest: oldest_date, newest: newest_date };
        },

        _getEventPosition: function( event_data ){
            var instance = this;
            var branch_name = event_data.branch;
            var timeline = instance._data.timelines[ branch_name ];
            var start_date = timeline.oldest;
            var end_date = timeline.newest;
            var event_date = event_data.date.getTime();
            var position = ( event_date - start_date ) / ( end_date - start_date ) * 100;
            
            return position;
        },

        _setAll: function(){
            var instance = this;
            // Set min/max extremes
            instance._setMinMaxDates.call(instance);
            // Set events and organize by date
            instance._setEvents.call(instance);
            // Set branches
            instance._setBranches.call(instance);
            // Organize events by branches
            instance._setTimelines.call(instance);
        },
        _setMinMaxDates: function(){
            var instance = this;
            var settings = instance.settings;
            var events = settings.events;
            var extremes = instance._getMinMaxDates.call( this, events );

            // Add the dates to our instance data
            instance._data.oldest = extremes.oldest;
            instance._data.newest = extremes.newest;
        },
        _setBranches: function(){
            var instance = this;
            var settings = instance.settings;
            var events = instance._data.events;
            var branches = [];

            // Loop through all events and figure out how many branches we have
            // Create an entry for each branch
            for (var i = events.length - 1; i >= 0; i--) {
                var event_object = events[i];

                // If an event doesn't have a branch, it's "master"
                if ( event_object.branch === undefined ){
                    event_object.branch = 'master';
                }
                // Add an entry for the branch.
                // If it already exists, it'll be overwritten.
                if ( branches.indexOf( event_object.branch ) < 0 ){
                    branches.push( event_object.branch );
                }
            }
            // Add branches to our instance data
            instance._data.branches = branches;            
        },
        _setEvents: function(){
            var instance = this;
            var settings = instance.settings;
            var events = settings.events;
            var temp_events = events.slice(0);

            // Sorts all of the individual events into chronological order
            temp_events.sort(function(a, b){
                if ( a.date.getTime() > b.date.getTime() ){
                    return 1;
                }
                else if ( a.date.getTime() < b.date.getTime() ){
                    return -1;
                }
                else {
                    return 0;
                }
            });
            // Add a copy of our sorted events
            instance._data.events = temp_events;
        },
        _setTimelines: function(){
            var instance = this;
            var settings = instance.settings;
            var events = instance._data.events;
            var branches = instance._data.branches;
            var timelines = {};

            // Loop through all branches
            // Gather all events that belong to each branch together.
            for (var j = branches.length - 1; j >= 0; j--) {
                var branch_name = branches[j];

                var branch_events = events.filter(function(object, index) {
                    return object.branch === branch_name;
                });

                var branch_extremes = instance._getMinMaxDates.call( this, branch_events );

                timelines[ branch_name ] = { events: branch_events, oldest: branch_extremes.oldest, newest: branch_extremes.newest };
            }

            // Add the timelines to our instance data
            instance._data.timelines = timelines;
        },

        /**
         * Bind our plugin events.
         * Specifically bind to the native events and use requestAnimationFrame to throttle them to our plugin events.
         */
        _bindEvents: function(){
            var instance = this;
            var $element = jQuery(instance.element);
            var $scroller = $element.find('.tl__scroller');
            var $previous = $element.find('.tl__previous');
            var $next = $element.find('.tl__next');
            var $event_nav_item_btn = $element.find('.tl__event-nav-item-btn');

            $scroller.on('scroll', function(){ instance._rAFScroll.call(instance); });

            $previous.on('click', function(){} );
            $next.on('click', function(){} );
        },

        /**
         * Set a universal requestAnimationFrame for browsers.
         */
        _setRAF: function(){
            var windowElement = window;
            windowElement.requestAnimFrame = (function(callback) {
            return  windowElement.requestAnimationFrame || 
                    windowElement.webkitRequestAnimationFrame || 
                    windowElement.mozRequestAnimationFrame || 
                    windowElement.oRequestAnimationFrame || 
                    windowElement.msRequestAnimationFrame ||
                    // Fallback to a timeout in older browsers
                    function(callback) {
                        windowElement.setTimeout(callback, 1000 / 60);
                    };
            })();
        },
        /**
         * requestAnimationFrame scrolling event.
         * This will help keep performance high and let's us use a special event just for the plugin.
         * @param  {Object} event [The original event object]
         */
        _rAFScroll: function( event ){
            var instance = this;

            if ( !frame ){
                frame = true;

                requestAnimFrame( function(){                     
                    instance._tlScroll.update_branches.call( instance );

                });
            }
        },
        /**
         * Our main event function.
         * Should fire on window load, as well as the instance container's scrolling and resizing events.
         * Includes jQuery events and callback function firing (so the user can do either event based or callback based).
         */
        _event: function(){
        	var instance = this;


            // The event is complete. We're ready to do another.
            frame = false;
        },


        _tlScroll: {
            update_branches: function(){
                var instance = this;
                var $element = jQuery(instance.element);
                var $scroller = $element.find('.tl__scroller');
                var scroller_progress = ( !instance.settings.vertical ) ? $scroller.scrollLeft() : $scroller.scrollTop();
                var scroller_length = ( !instance.settings.vertical ) ? $scroller.outerWidth() : $scroller.outerHeight();
                var scroller_percent = scroller_progress / scroller_length * 100;
                var $branches = $scroller.find('.tl__branch');

                var current_date_time = parseInt( (scroller_percent / 100) * ( instance._data.newest - instance._data.oldest) + instance._data.oldest );
                var current_date = new Date(current_date_time);

                var event_object = {
                    type: pluginName + '.scroll',
                    current_date: current_date,
                    percent: scroller_percent
                };

                $element.data( 'plugin_' + pluginName + '_date', current_date );

                $branches.each(function(index, el) {
                    var $branch = jQuery(this);
                    var $progress = $branch.find('.tl__line-active');
                    var branch_offset = parseFloat( $branch.attr('data-tl-offset') );
                    var branch_length = parseFloat( $branch.attr('data-tl-length') );
                    var branch_range_start = branch_offset;
                    var branch_range_end = branch_offset + branch_length;
                    var branch_percent_raw = (scroller_percent - branch_range_start) / ( branch_length / 100 );
                    var branch_percent = 0;

                    if ( branch_percent_raw > 100 ){ branch_percent = 100; }
                    else if ( branch_percent_raw < 0 ){ branch_percent = 0; }
                    else { branch_percent = branch_percent_raw; }

                    var transform = ( !instance.settings.vertical ) ? 'scaleX('+ ( branch_percent / 100 ) +')' : 'scaleY('+ ( branch_percent / 100 ) +')';

                    $branch.data( 'plugin_' + pluginName + '_percent', branch_percent );
                    $progress.css({ transform: transform });
                });

                $element.trigger( event_object );
                frame = false;
            },
            to_event: function( index, branch ){
                var instance = this;
                var branch = ( branch !== undefined ) ? branch : 'master';
                var element = instance.element;
                var $element = jQuery(element);                
                var $event_nav = $element.find('.tl__event-nav');
                var $event_nav_item = $event_nav.find('.tl__event-nav-item[data-tl-event-branch="'+branch+'"]');

                var $branches = $element.find('.tl__branches');
                var $branch = $branches.find('[data-tl-branch="'+branch+'"]');
                var $events = $branch.find('.tl__events');
                var $event = $events.find('.tl__event').eq(index);

                $events.removeClass('is-active');
                $event.addClass('is-active');

            },
            to_date: function( date ){

            },
            previous: function(){

            },
            next: function(){

            },
        },

        _tlEvent: {
            create: function( event_data, index ){
                var instance = this;
                var element = instance.element;
                var $element = jQuery(element);
                var branch = event_data.branch;
                var $branches = $element.find('.tl__branches');
                var $branch = $branches.find('[data-tl-branch="'+branch+'"]');
                var $events = $branch.find('.tl__events');

                var position = instance._getEventPosition.call( this, event_data );
                var template_HTML = instance.settings.template.call( this, event_data );

                var event_HTML_array = ['<li class="tl__event" data-tl-event-branch="'+branch+'" style="left: '+position+'%;" data-event-date="'+event_data.date.getTime()+'">','<span class="tl__event-marker">','</span>','<div class="tl__event-content">', template_HTML, '</div>','</li>'];

                var event_HTML = event_HTML_array.join('\n');

                return event_HTML;             
            },
            add: function( event_data, index ){
                var instance = this;
                var event_HTML = instance._tlEvent.create.call(this, event_data);


            },
            remove: function(){

            }
        },

        /**
         * PUBLIC METHODS
         * ==============
         */

        next: function(){

        },

        previous: function(){

        },

        to: function(){

        },

        destroy: function(){

        },

        event: function( action, data ){
            switch(action){
                case 'add':

                    break;
                case 'remove':

                    break;
                default:
                    console.error('Not a valid event action.');
                    break;
            }
        },

        update: function(){

        },

        zoom: function(){

        }

    });

    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[ pluginName ] = function ( options ) {
        var args = Array.prototype.slice.call( arguments, 1);
        var result = null;
        this.each(function() {
            // Cache the instance of the plugin on this element
            var instance = $.data( this, "plugin_" + pluginName );
            // Does the plugin already exist on this element?
            if ( !instance ) {
                $.data( this, "plugin_" + pluginName, new Plugin( this, options ) );
            }
            // If the plugin already exists on this element, check the string because someone is probably trying to get a public method going.
            else if ( typeof options === 'string' && options.charAt(0) !== '_' && $.isFunction(instance[options]) ){
                result = instance[options].apply(instance, args);
            }
        });
        // Isn't null if we run a public method that returns information.
        // Return the method result instead.
        if ( result !== null ){
        	return result;
        }
        // Return the jQuery object
        else {
	        return this;
	    }
    };
}));
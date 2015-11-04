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
            centerProgress: false, // Centers the timeline so that the progress bar is always centered during scroll
            animation: false, // Animate scrolling
            animationSpeed: 1000, // Animation speed
            animationEasing: 'swing', // Animation easing
            directionNav: true, // Previous / Next navigation
            directionNavContainer: null, // Selector for nav to be built in
            directionNavBranch: null, // Keep it only in the specified branch
            directionNextText: 'Next',
            directionPreviousText: 'Previous',
            eventNav: true, // Single event nav (dots)
            eventNavBranch: 'master', // Branch that those events should navigate
            eventNavContainer: null, // Selector for nav to be built in
            keyboard: true, // Bind keyboard arrow keys
            continuePast: false, // Add styles to 'extend' tl
            continueFuture: false, // Add styles to 'extend' tl
            startDate: null, // Accepts a Date object and tries to 'start' the tl at that position
            zoom: 1, // "Zoom" in on the timeline
            snap: true,

            eventContentShow: true, // Construct 'tooltip' event content 
            eventContentKeepPastActive: false, // Keep the active class on past event content
            eventContentPosition: 'top center' // Position of the event information (top, bottom, left, right)

        },
        rAF = null,
        skip = false,
        frame = false,
        guid = null;

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

        base._data = {
            date: {},
            branches: [],
            timelines: {},
            scroller: {}
        };

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

            instance._constructEvents.call(instance);
            // Make the navigation for next/previous
            if ( instance.settings.directionNav ){
                instance._constructDirectionNav.call(this);
            }
            // Make the event navigation
            if ( instance.settings.eventNav ){
                instance._constructEventNav.call(this);
            }
            if ( instance.settings.eventContentShow ){
                instance._constuctEventContent.call(this);
            }
            // Set center timeline
            if ( instance.settings.centerProgress ){
                instance._setCenterTimeline.call(instance);
            }
        
            // Bind events
            instance._bindEvents.call(this);

            // Go to the start date, if supplied
            if ( instance.settings.startDate !== null && instance.settings.startDate instanceof Date ){
                instance._tlScroll.to_date.call( this, instance.settings.startDate );
            }
            // Otherwise go to the oldest date
            else {
                instance._tlScroll.to_date.call( this, new Date( instance._data.date.oldest ) );
            }

            jQuery(instance.element).find('.tl__scroller').trigger('scroll');
        },

        _construct: function(){
            var instance = this;
            var element = instance.element;
            var $element = jQuery(element);
            var zoom = instance.settings.zoom * 100;
            var is_horizontal = ( !instance.settings.vertical );
            var HTML_array = ( is_horizontal ) ? ['<div class="tl__scroller">','<div class="tl__branches" style="width: '+zoom+'%;">'] : ['<div class="tl__scroller">','<div class="tl__branches" style="height: '+zoom+'%;">'];
            var direction_class = ( !instance.settings.vertical ) ? 'tl--horizontal' : 'tl--vertical';
            var center_class = ( instance.settings.centerProgress ) ? 'tl--center-progress' : '';
            var branches_HTML = instance._constructBranches.call(this);

            HTML_array.push(branches_HTML);

            HTML_array = HTML_array.concat(['</div>','</div>']);
            HTML = HTML_array.join('\n');

            $element.addClass('tl').addClass(direction_class).addClass(center_class).html(HTML);
        },
        _constructBranches: function(){
            var instance = this;
            var branches = instance._data.branches;
            var timelines = instance._data.timelines;
            var is_horizontal = ( !instance.settings.vertical );
            var start_date = instance._data.date.oldest;
            var end_date = instance._data.date.newest;
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
            var directionNavBranch = ( instance.settings.directionNavBranch !== null ) ? 'data-tl-branch="'+directionNavBranch+'"' : '';
            var HTML_array = ['<div class="tl__direction-nav">','<button type="button" class="btn btn--tl tl__previous" '+directionNavBranch+'>', instance.settings.directionPreviousText,'</button>','<button type="button" class="btn btn--tl tl__next">',instance.settings.directionNextText,'</button>','</div>'];
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
                var event_HTML = ['<li class="tl__event-nav-item">','<button type="button" class="btn btn--tl-event-nav tl__event-nav-btn" data-tl-event-date="'+event_object.date.getTime()+'" data-tl-event-branch="'+eventNavBranch+'">','</button>','</li>'];
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
        _constructEvents: function(){
            var instance = this;
            var element = instance.element;
            var $element = jQuery(element);
            var timelines = instance._data.timelines;

            // Loop through all timelines / branches
            for (var key in timelines){
                var HTML = '';
                var timeline = timelines[key];
                var events = timeline.events;
                var $timeline = $element.find('[data-tl-branch="'+key+'"]');
                var $events = $timeline.find('.tl__events');

                // Loop through and create individual events
                for (var i = 0; i < events.length; i++) {
                    var event_data = events[i];
                    var event_HTML = instance._tlEvent.create.call( this, event_data, i );

                    HTML += event_HTML;
                }
                // Add the events
                $events.append(HTML);
            }
        },
        _constuctEventContent: function(){
            var instance = this;
            var element = instance.element;
            var $container = null;
            var events = instance._data.events;
            var HTML = '';

            if ( !jQuery('.tl__events-container').length ){
                $container = jQuery('.tl__events-container');jQuery('body').append('<div id="tlEventsContainer-'+GUID+'" class="tl__events-container"></div>');
            }

            $container = jQuery('.tl__events-container');

            // Loop through and create individual events
            for (var i = 0; i < events.length; i++) {
                var event_data = events[i];
                var event_HTML = instance._tlEvent.createContent.call( this, event_data, i );

                HTML += event_HTML;
            }
            // Add the events
            $container.append(HTML);
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
        _getClosestDate: function( date_time ){
            var instance = this;
            var events = instance._data.events;
            var events_dates = events.map(function(elem, index) {
                return elem.date.getTime();
            });
            var closest = events_dates.reduce(function (prev, curr) {
                return (Math.abs(curr - date_time) < Math.abs(prev - date_time) ? curr : prev);
            });
            var closest_index = events_dates.indexOf(closest);
            var closest_event = events[closest_index];
            var closest_date = closest_event.date;

            return closest_date;
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
            // Set GUID
            instance._setGlobalUniqueID.call(instance);
        },
        _setGlobalUniqueID: function(){
            var instance = this;
            var $element = jQuery(instance.element);
            var ID = Math.floor(Math.random() * 26) + Date.now();

            GUID = ID;
        },
        _setMinMaxDates: function(){
            var instance = this;
            var settings = instance.settings;
            var events = settings.events;
            var extremes = instance._getMinMaxDates.call( this, events );

            // Add the dates to our instance data
            instance._data.date.oldest = extremes.oldest;
            instance._data.date.newest = extremes.newest;
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
        _setCenterTimeline: function(){
            var instance = this;
            var element = instance.element;
            var $element = jQuery(element);
            var $scroller = $element.find('.tl__scroller');
            var $branches = $element.find('.tl__branches');
            var height = $scroller.outerHeight();
            var width = $scroller.outerWidth();
            var padding = ( instance.settings.vertical ) ? height / 2 : width / 2;
            var zoom = instance.settings.zoom;

            if ( instance.settings.vertical && zoom > 1 ){
                $branches.css({ paddingTop: padding, paddingBottom: padding });
            }
        },
        /**
         * Bind our plugin events.
         * Specifically bind to the native events and use requestAnimationFrame to throttle them to our plugin events.
         */
        _bindEvents: function(){
            var instance = this;
            var $element = jQuery(instance.element);
            var $scroller = $element.find('.tl__scroller');

            var direction_nav_container = instance.settings.directionNavContainer;
            var $direction_nav_container = ( direction_nav_container !== null ) ? jQuery(direction_nav_container) : $element;
            var $previous = $direction_nav_container.find('.tl__previous');
            var $next = $direction_nav_container.find('.tl__next');

            var event_nav_container = instance.settings.eventNavContainer;
            var $event_nav_container = ( event_nav_container !== null ) ? jQuery(event_nav_container) : $element;
            var $event_nav_item_btn = $event_nav_container.find('.tl__event-nav-btn');
            var $event_marker = $element.find('.tl__event-marker');

            jQuery(window).on('resize', function(){ instance._rAFResize.call(instance); });

            // Scroller
            $scroller.on('scroll', function(){ instance._rAFScroll.call(instance); });

            // Direction
            $previous.on('click', function(){ instance._tlNav.previous.call(instance); } );
            $next.on('click', function(){ instance._tlNav.next.call(instance); } );

            // Navigation
            $event_nav_item_btn.on('click', function(){ 
                var $button = jQuery(this);
                var branch = $button.attr('data-tl-event-branch');
                var event_date_time = parseInt( $button.attr('data-tl-event-date') );

                instance._tlNav.item.call(instance, branch, event_date_time); 
            });

            // Events
            $event_marker.on('click', function(){
                var $button = jQuery(this);
                var $parent = $button.parent('li');
                var branch = $parent.attr('data-tl-event-branch');
                var event_date_time = parseInt( $parent.attr('data-tl-event-date') );

                instance._tlNav.item.call(instance, branch, event_date_time); 
            });

            // Keyboard
            if ( instance.settings.keyboard ){
                jQuery(document).on('keydown', function(event){
                    var keyCode = event.keyCode;
                    event.preventDefault();
                    event.stopPropagation();
                    switch(keyCode){
                        case 37: // Left
                            instance._tlNav.previous.call(instance);
                            break;
                        case 39: // Right
                            instance._tlNav.next.call(instance);
                            break;
                    }
                });
            }
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
        _rAFResize: function( event ){
            var instance = this;

            if ( !frame ){
                frame = true;

                rAF = requestAnimFrame( function(){
                    instance._setCenterTimeline.call(instance);

                    frame = false;
                });
            }
        },
        /**
         * requestAnimationFrame scrolling event.
         * This will help keep performance high and let's us use a special event just for the plugin.
         * @param  {Object} event [The original event object]
         */
        _rAFScroll: function( event ){
            var instance = this;

            // Is the frame open?
            // Are we skipping this one?
            if ( !frame && !skip ){
                frame = true;

                rAF = requestAnimFrame( function(){
                    var $element = jQuery(instance.element);
                    var $scroller = $element.find('.tl__scroller');
                    var scroller_progress = ( !instance.settings.vertical ) ? $scroller.scrollLeft() : $scroller.scrollTop();
                    var scroller_length = ( !instance.settings.vertical ) ? $scroller.outerWidth() : $scroller.outerHeight();
                    var scroller_percent = scroller_progress / scroller_length * 100;

                    instance._data.scroller.progress = scroller_progress;
                    instance._data.scroller.percent = scroller_percent;

                    instance._tlScroll.update_date.call( instance );
                    instance._tlScroll.update_events.call( instance );
                    instance._tlScroll.update_branches.call( instance );

                    instance._event.call( instance, 'scroll' );
                });
            }
            // We skipped one
            // Reset it
            else if ( skip ) {
                skip = false;
            }
        },
        /**
         * Our main event function.
         * Should fire on window load, as well as the instance container's scrolling and resizing events.
         * Includes jQuery events and callback function firing (so the user can do either event based or callback based).
         */
        _event: function( type ){
        	var instance = this;
            var $element = jQuery(instance.element);
            var event_object = {};

            switch( type ){
                case 'scroll':
                    // Create an event object
                    event_object = {
                        type: type + '.' + pluginName,
                        date: instance._data.date.current,
                        current_event: instance._data.event_object,
                        percent: instance._data.scroller.percent
                    };
                    // Trigger our special scroll event
                    $element.trigger( event_object );
                    break;
                case 'animationStart':
                case 'animationEnd':
                    // Create an event object
                    event_object = {
                        type: type + '.' + pluginName,
                        date: instance._data.date.current,
                        current_event: instance._data.event_object,
                        percent: instance._data.scroller.percent
                    };
                    // Trigger our special scroll event
                    $element.trigger( event_object );
                    break;
            }

            // The event is complete. We're ready to do another.
            frame = false;
        },
        _tlScroll: {
            update_date: function(){
                var instance = this;
                var scroller_percent = instance._data.scroller.percent;
                // Get the current date in milliseconds
                var current_date_time_raw = Math.round( (scroller_percent / 100) * (instance._data.date.newest - instance._data.date.oldest) + instance._data.date.oldest );

                // Save the current date
                // This date is technically inaccurate. 
                // It will be fixed when we're done with our scrolling.
                instance._data.date.current = current_date_time_raw;
            },
            update_branches: function(){
                var instance = this;
                var $element = jQuery(instance.element);
                var $scroller = $element.find('.tl__scroller');
                var $branches = $scroller.find('.tl__branch');
                var current_date_time = instance._data.date.current;

                // Set the progress bar for each branch
                $branches.each(function(index, el) {
                    var $branch = jQuery(this);
                    var $progress = $branch.find('.tl__line-active');
                    var branch = $branch.attr('data-tl-branch');
                    var branch_object = instance._data.timelines[branch];
                    var branch_oldest = branch_object.oldest;
                    var branch_newest = branch_object.newest;
                    var branch_percent_raw = ( current_date_time - branch_oldest ) / ( branch_newest - branch_oldest ) * 100;
                    var branch_percent = 0;

                    // The branch could be out of range. Keep it in range.
                    if ( branch_percent_raw > 100 ){ branch_percent = 100; }
                    else if ( branch_percent_raw < 0 ){ branch_percent = 0; }
                    else { branch_percent = branch_percent_raw; }

                    // Calculate the transform the progress bar
                    var transform = ( !instance.settings.vertical ) ? 'scaleX('+ ( branch_percent / 100 ) +')' : 'scaleY('+ ( branch_percent / 100 ) +')';

                    // Save the percent
                    $branch.data( 'plugin_' + pluginName + '_percent', branch_percent );
                    // Transform the bar
                    $progress.css({ transform: transform, webkitTransform: transform });
                });
            },
            update_events: function( snap ){
                var instance = this;
                var $element = jQuery(instance.element);
                var events = instance._data.events;
                var current_date_time_raw = instance._data.date.current;
                var closest_date = instance._getClosestDate.call( instance, current_date_time_raw );
                // If dates do not snap, manual scrolling behavior will make the closer event be "current"
                // This is not desirable in the traditional timeline (you don't want a current event to light up when it hasn't happened yet)
                // So, unless the user specifies a date, we don't snap
                var current_date_time = ( !!snap ) ? closest_date.getTime() : current_date_time_raw;


                // Loop through all events to set their state
                for (var i = 0; i < events.length; i++) {
                    var event_object = events[i];
                    var event_date = event_object.date;
                    var event_date_time = event_date.getTime();
                    // What are the times next to this one?
                    var event_date_time_next = ( events[i+1] !== undefined ) ? events[i+1].date.getTime() : instance._data.date.newest;
                    var event_date_time_previous = ( events[i-1] !== undefined ) ? events[i-1].date.getTime() : instance._data.date.oldest;
                    // Find the events
                    // Yes, this could theoretically match events on multiple branches.
                    var $event_current = $element.find('.tl__event[data-tl-event-date="'+event_date_time+'"]');
                    var $event_next = $element.find('.tl__event[data-tl-event-date="'+event_date_time_next+'"]');
                    var $event_previous = $element.find('.tl__event[data-tl-event-date="'+event_date_time_previous+'"]');

                    // Update past and future classes
                    if ( event_date_time > current_date_time ){
                        $event_current.addClass('is-future').removeClass('is-past');
                    }
                    else {
                        $event_current.removeClass('is-future').addClass('is-past');
                    }

                    // Update current event class
                    if ( event_date_time === current_date_time || ( event_date_time <= current_date_time && current_date_time < event_date_time_next && current_date_time >= event_date_time_previous ) ){
                        $event_current.addClass('is-current');
                        instance._data.date.current_event = event_date_time;
                        instance._data.event_object = event_object;
                        instance._tlScroll.update_event_nav.call( instance, event_date_time );
                    }
                    else {
                        $event_current.removeClass('is-current');
                    }
                }
                if ( instance.settings.eventContentShow ){
                    instance._tlScroll.update_event_content.call( instance );
                }
            },
            update_event_nav: function( event_date_time ){
                var instance = this;
                var branch = instance.settings.eventNavBranch;
                var $element = jQuery(instance.element);
                var $event_nav_container = ( instance.settings.eventNavContainer !== null ) ? jQuery(instance.settings.eventNavContainer) : $element ;
                var $event_nav = $event_nav_container.find('.tl__event-nav');
                var $events = $event_nav.find('.tl__event-nav-btn');
                var $event_current = $event_nav.find('.tl__event-nav-btn[data-tl-event-branch="'+branch+'"][data-tl-event-date="'+event_date_time+'"]');

                // Update classes
                $events.removeClass('is-active');
                $event_current.addClass('is-active');
            },
            update_event_content: function( $timeline_event, $container_event ){
                var instance = this;
                var $element = jQuery(instance.element);
                var $branches = $element.find('.tl__branches');
                var $timeline_events = $branches.find('.tl__event');
                var $container = jQuery('#tlEventsContainer-'+GUID);

                for (var i = $timeline_events.length - 1; i >= 0; i--) {
                    var timeline_event = $timeline_events[i];
                    var $timeline_event = jQuery(timeline_event);
                    var timeline_event_pos = timeline_event.getBoundingClientRect();
                    var tl_event_date = parseInt( $timeline_event.attr('data-tl-event-date') );
                    var tl_event_branch = $timeline_event.attr('data-tl-event-branch');
                    var $container_event = $container.find('.tl__event-content[data-tl-event-date="'+tl_event_date+'"][data-tl-event-branch="'+tl_event_branch+'"]');

                    instance._tlScroll.update_event_content_position.call( instance, timeline_event, $container_event );
                    instance._tlScroll.update_event_content_visibility.call( instance, timeline_event, $container_event );
                }
            },
            update_event_content_position: function( timeline_event, $container_event ){
                var $container = jQuery('body').find('.tl__events-container');
                var $timeline_event = jQuery(timeline_event);
                var $timeline_event_marker = $timeline_event.find('.tl__event-marker');

                var timeline_event_pos = $timeline_event_marker[0].getBoundingClientRect();
                var x = ( timeline_event_pos.left + timeline_event_pos.right ) / 2;
                var y = ( timeline_event_pos.top + timeline_event_pos.bottom ) / 2;
                var transform = 'translate3d('+x+'px,'+y+'px, 0)'; // GPU accellerated 

                $container_event.css({ transform: transform, webkitTransform: transform });
            },
            update_event_content_visibility: function( timeline_event, $container_event ){
                var instance = this;
                var $timeline_event = jQuery(timeline_event);

                if ( instance.settings.eventContentKeepPastActive ){
                    if ( $timeline_event.hasClass('is-past') || $timeline_event.hasClass('is-current') ){
                        $container_event.addClass('is-active');
                    }
                    else {
                        $container_event.removeClass('is-active');
                    }
                }
                else {
                    if ( $timeline_event.hasClass('is-current') ){
                        $container_event.addClass('is-active');
                    }
                    else {
                        $container_event.removeClass('is-active');
                    }

                    if ( $timeline_event.hasClass('is-past') ){
                        $container_event.addClass('is-past');
                    }
                    else {
                        $container_event.removeClass('is-past');
                    }
                }
            },
            to_date: function( date, arg_snap ){
                var instance = this;
                var $element = jQuery(instance.element);
                var $scroller = $element.find('.tl__scroller');
                var scroller_length = ( !instance.settings.vertical ) ? $scroller.outerWidth() : $scroller.outerHeight();
                // Extremes
                var start_date = instance._data.date.oldest;
                var end_date = instance._data.date.newest;
                // Target date
                var to_date = date.getTime();
                // How far should the scroller go?
                var scroller_percent = ( to_date - start_date ) / ( end_date - start_date ); 
                // Final scroll position in px
                // Ceiling is to force the scroller to actually go on or past the event.
                // The scroll bar can only go to intergers, while many of our scroll_to_raw would result in fractions.
                // This keeps the dates fairly accurate in calls, but may cause problems in some instances.
                // @todo: find a way to make this more accurate while keeping functionality
                // @update: Accuracy has mostly been addressed! It really means making sure we reset our stored date and events. It can be overridden with the 'snap' setting, which may or may not end up public.
                var scroll_to_raw = scroller_percent * scroller_length;
                var scroll_to = Math.ceil( scroll_to_raw ); 
                var snap = ( arg_snap !== undefined ) ? instance.settings.snap : arg_snap;
                var animation_options = {
                    // Doing this so we always get a callback
                    duration: ( !instance.settings.animation ) ? 0 : instance.settings.animationSpeed,
                    easing: instance.settings.animationEasing,
                    start: function(){ 
                        // No reason to do this if we are not animating
                        if ( instance.settings.animation ) {
                            // Set classes
                            $scroller.addClass('is-animating');
                            instance._event.call(instance, 'animationStart');                             
                        }
                    },
                    always: function(){ 
                        // No reason to do this if we are not animating
                        if ( instance.settings.animation ) {
                            // Classes
                            $scroller.removeClass('is-animating');
                            instance._event.call(instance, 'animationEnd');
                        }
                        // Reset the current date
                        instance._data.date.current = to_date;
                        // Reset events
                        instance._tlScroll.update_events.call(instance, snap);
                        // Reset branches
                        instance._tlScroll.update_branches.call(instance);
                        // If snapping is on (true by default), skip the next frame.
                        // Why? Because if we don't a scroll will fire and cause everything to get messed up.
                        // We also don't want another scroll event firing after they supposedly stopped.
                        if ( instance.settings.snap ){
                            skip = true;
                        }
                    }
                };

                // Go there
                if ( !instance.settings.vertical ){
                    $scroller.stop(true, false).animate({ scrollLeft: scroll_to }, animation_options );
                }
                else {
                    $scroller.stop(true, false).animate({ scrollTop: scroll_to }, animation_options );
                }
            },
            /**
             * Scroll to the previous event
             * @param  {String}   arg_branch [The name of the branch. Use this to navigate specific branches.]
             */
            previous: function( arg_branch ){
                var instance = this;
                var $element = jQuery(instance.element);
                var branches = instance._data.branches;
                // Pull events from the branch, otherwise get all of them
                var events = ( arg_branch !== undefined && branches.indexOf(arg_branch) > -1 ) ? instance._data.timelines[arg_branch].events : instance._data.events;
                var current_date_time = instance._data.date.current;
                var current_event = instance._data.date.current_event;



                // Loop through all events (backwards)
                for (var i = events.length - 1; i >= 0; i--) {
                    var this_event = events[i];
                    var this_event_date = this_event.date;
                    var this_event_date_time = this_event_date.getTime();

                    // If the event matches
                    if ( this_event_date_time < current_date_time && this_event_date_time !== current_event ){
                        instance._tlScroll.to_date.call( instance, this_event_date ); // Go there
                        break; // We found it, stop doing this
                    }
                };
            },
            /**
             * Scroll to the next event
             * @param  {String}   arg_branch [The name of the branch. Use this to navigate specific branches.]
             */
            next: function( arg_branch ){
                var instance = this;
                var $element = jQuery(instance.element);
                var branches = instance._data.branches;
                // Pull events from the branch, otherwise get all of them
                var events = ( arg_branch !== undefined && branches.indexOf(arg_branch) > -1 ) ? instance._data.timelines[arg_branch].events : instance._data.events;
                var current_date_time = instance._data.date.current;

                // Loop through all events
                for (var i = 0; i < events.length; i++) {
                    var this_event = events[i];
                    var this_event_date = this_event.date;
                    var this_event_date_time = this_event_date.getTime();

                    // If the event matches
                    if ( this_event_date_time > current_date_time && this_event_date_time !== current_date_time ){
                        instance._tlScroll.to_date.call( instance, this_event_date ); // Go there
                        break; // We found it, stop doing this
                    }
                };
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
                var is_horizontal = ( !instance.settings.vertical );
                var event_HTML_content = instance._tlEvent.createContent.call( this, event_data );
                var event_HTML_array = ( is_horizontal ) ? ['<li class="tl__event" data-tl-event-branch="'+branch+'" style="left: '+position+'%;" data-tl-event-date="'+event_data.date.getTime()+'">','<span class="tl__event-marker">','</span>',event_HTML_content,'</li>'] : ['<li class="tl__event" data-tl-event-branch="'+branch+'" style="top: '+position+'%;" data-tl-event-date="'+event_data.date.getTime()+'">','<span class="tl__event-marker">','</span>',event_HTML_content,'</li>'];
                var event_HTML = event_HTML_array.join('\n');

                return event_HTML;             
            },
            createContent: function( event_data ){
                var instance = this;
                var branch = event_data.branch;
                var template_HTML = instance.settings.template.call( this, event_data );
                var event_content_position = instance.settings.eventContentPosition;
                var event_HTML_array = ['<div class="tl__event-content" data-tl-event-branch="'+branch+'" data-tl-event-date="'+event_data.date.getTime()+'" data-tl-event-position="'+event_content_position+'">', template_HTML, '</div>'];
                var event_HTML = event_HTML_array.join('\n');

                return event_HTML; 
            },
            add: function( event_data, index ){
                var instance = this;
                var event_HTML = instance._tlEvent.create.call(instance, event_data);


            },
            remove: function(){

            },
            to: function( arg_event_index, arg_event_date_time, arg_branch ){
                var instance = this;
                var branch = ( arg_branch !== undefined && instance._data.branches.indexOf(branch) > -1 ) ? arg_branch : instance.settings.eventNavBranch;
                // Events from the right branch.
                var events = instance._data.timelines[branch].events;
                // Get the closest one. 
                // Since we're trying to get to a specific event, this is exactly what we want
                var closest_date = instance._getClosestDate( arg_event_date_time ); 
                var event_object_possible = events.filter(function(elem, index) {
                    return elem.date.getTime() === closest_date.getTime();
                });
                // Get the right object. People will probably use dates more than index.
                var event_object = ( !arg_event_index ) ? event_object_possible[0] : events[arg_event_index];
                var event_date = event_object.date;

                instance._tlScroll.to_date.call( instance, event_date, true ); // Go there
            }
        },

        _tlNav: {
            next: function(){
                var instance = this;
                var branch = ( instance.settings.directionNavBranch !== null ) ? instance.settings.directionNavBranch : undefined;

                instance._tlScroll.next.call( this, branch );
            },
            previous: function(){
                var instance = this;
                var branch = ( instance.settings.directionNavBranch !== null ) ? instance.settings.directionNavBranch : undefined;

                instance._tlScroll.previous.call( this, branch );
            },
            item: function( branch, event_date_time ){
                var instance = this;
                var event_date = new Date( event_date_time );

                instance._tlScroll.to_date.call( this, event_date );
            },
        },

        /**
         * PUBLIC METHODS
         * ==============
         */

        /**
         * Go to the next event item
         * @param  {String}   arg_branch [The name of the branch. Use this to navigate specific branches.]
         */
        next: function( arg_branch ){
            var instance = this;
            var branch = ( arg_branch !== undefined && instance._data.branches.indexOf(arg_branch) > -1 ) ? arg_branch : instance.settings.eventNavBranch;

            instance._tlScroll.next.call( this, branch );
        },
        /**
         * Go to the previous event item
         * @param  {String}   arg_branch [The name of the branch. Use this to navigate specific branches.]
         */
        previous: function( arg_branch ){
            var instance = this;
            var branch = ( arg_branch !== undefined && instance._data.branches.indexOf(arg_branch) > -1 ) ? arg_branch : instance.settings.eventNavBranch;

            instance._tlScroll.previous.call( this, branch );
        },

        last: function( arg_branch ){
            var instance = this;
            var branch = ( arg_branch !== undefined && instance._data.branches.indexOf(arg_branch) > -1 ) ? arg_branch : instance.settings.eventNavBranch;
            var events = instance._data.timelines[branch].events;
            var event_index = events.length - 1;

            instance._tlEvent.to.call( instance, event_index, false, branch );
        },

        first: function( arg_branch ){
            var instance = this;
            var branch = ( arg_branch !== undefined && instance._data.branches.indexOf(arg_branch) > -1 ) ? arg_branch : instance.settings.eventNavBranch;

            instance._tlEvent.to.call( instance, 0, false, branch );
        },

        destroy: function(){

        },

        event: function( action, data ){
            var instance = this;
            switch(action){
                case 'add':

                    break;
                case 'remove':

                    break;
                case 'to':
                    var event_date_time = ( data.date !== undefined ) ? data.date : false;
                    var event_index = ( data.index !== undefined ) ? data.index : false;
                    var event_branch = data.branch;

                    instance._tlEvent.to.call( instance, event_index, event_date_time, event_branch );
                    break;
                default:
                    console.error('Not a valid event action.');
                    break;
            }
        },

        update: function(){

        },
        /**
         * Get the zoom level or sets the zoom level of the timeline on request.
         * @param  {Number} number [The new zoom to set the timeline to]
         * @return {Number} [The current zoom level of the timeline]
         */
        zoom: function( number ){
            var instance = this;
            var element = instance.element;
            var $element = jQuery(element);
            var $scroller = $element.find('.tl__scroller');
            var $branches = $element.find('.tl__branches');
            var scroller_width = $scroller.outerWidth();
            var branches_width = $branches.outerWidth();
            // Get the current zoom
            var current_zoom = branches_width / scroller_width;
            // Only use the new zoom if it is a number, bigger than 0, and not the same as the current
            var zoom = ( !isNaN(number) && number > 0 && number !== current_zoom ) ? number : current_zoom;

            if ( number === undefined || isNaN(number) || number === current_zoom ) {
                // Get the zoom
                return zoom;
            }
            else {
                // Set the zoom
                if ( instance.settings.vertical ){
                    $branches.css({ height: zoom*100+'%' });
                }
                else {
                    $branches.css({ width: zoom*100+'%' });
                }
            }
        },
        /**
         * Gets the current date of the timeline or sets the timeline on a date specified
         * 
         * @param {Date} date [The date you want to set the timeline to]
         * @return {Date} [The date object of the current date of the timeline]
         */
        date: function( date, arg_snap ){
            var instance = this;
            var current_date_time = instance._data.date.current;
            var current_date = new Date( current_date_time );
            var snap = ( arg_snap !== undefined ) ? arg_snap : false;

            if ( date !== undefined && date instanceof Date ){
                // Set the date
                // Don't let it snap, unless the user wanted it to
                instance._tlScroll.to_date.call( this, date, snap );
            }
            else {
                // Get the date
                return current_date;
            }
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
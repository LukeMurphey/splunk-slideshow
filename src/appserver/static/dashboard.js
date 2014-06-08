require.config({
    paths: {
        store: "../app/slideshow/contrib/store.min",
        slideshow_player: "../app/slideshow/js/SlideshowPlayer",
    },
	shim: {
	    store: {
	    	exports: 'store'
	    },
	    slideshow_player: {
	    	exports: 'SplunkSlideshow',
	    	deps: ['store']
	    }
	}
});

require([
         "jquery",
         "underscore",
         "backbone",
         "store",
         "slideshow_player",
         "splunkjs/mvc/simplexml/ready!"
     ], function(
         $,
         _,
         Backbone,
         store,
         SplunkSlideshow
     )
     {
		// Make store global so that SplunkSlideshow can see it
		window.store = store;
		SplunkSlideshow.startShow();
         
     }
);
require.config({
    paths: {
        store: "../app/slideshow/contrib/store.min",
        slideshow_player: "../app/slideshow/js/SlideshowPlayer",
        nprogress: "../app/slideshow/contrib/nprogress/nprogress",
    },
	shim: {
	    store: {
	    	exports: 'store'
	    },
	    slideshow_player: {
	    	exports: 'SplunkSlideshow',
	    	deps: ['store']
	    },
	    nprogress: {
	    	exports: 'NProgress',
	    	deps: ['jquery']
	    }
	}
});

require([
         "jquery",
         "underscore",
         "backbone",
         "store",
         "slideshow_player",
         "nprogress",
         "css!../app/slideshow/contrib/nprogress/nprogress.css",
         "splunkjs/mvc/simplexml/ready!"
     ], function(
         $,
         _,
         Backbone,
         store,
         SplunkSlideshow,
         NProgress
     )
     {
		// Make store global so that SplunkSlideshow can see it
		window.store = store;
		window.NProgress = NProgress;
		SplunkSlideshow.startShow();
         
     }
);
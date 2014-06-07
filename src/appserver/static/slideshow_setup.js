
//Translations for en_US
i18n_register({"plural": function(n) { return n == 1 ? 0 : 1; }, "catalog": {}});

require.config({
    paths: {
        slideshow_setup_view: '../app/slideshow/js/views/SlideshowSetupView'
    }
});

require(['jquery','underscore','splunkjs/mvc', 'slideshow_setup_view', 'splunkjs/mvc/simplexml/ready!'],
		function($, _, mvc, SlideshowSetupView){
	
    // Render the slideshow setup page
    var slideshowSetupView = new SlideshowSetupView({
        el: $('#slideshow_setup_screen')
    });
    
    // Render the page
    slideshowSetupView.render();
	
});
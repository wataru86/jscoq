// The CoqLayoutClassic class.
// Copyright (C) 2015-2017 Mines ParisTech/ARMINES
//
// This class provides a plugabble side panel with proof and query
// buffers.

"use strict";

/***********************************************************************/
/* The CoqLayout class contains the goal, query, and packages buffer   */
/***********************************************************************/

/**
 * Classical layout: a right panel containing a toolbar with buttons at the 
 * top, and a main area divided vertically into three collapsible panes.
 * Also shows a power button that hides or shows the panel.
 */
class CoqLayoutClassic {

    html(base_path) {
        var html = `
    <svg id="hide-panel" style="position:absolute; left:-34px; top:2px" title="Toggle panel (F8)" width="32" height="32">
        <path d="M16.001,0C7.165,0,0,7.164,0,16.001S7.162,32,16.001,32C24.838,32,32,24.835,32,15.999S24.838,0,16.001,0L16.001,0z"/>
        <g>
        <path fill="#FFFFFF" d="M14,4.212c0-0.895,0.607-1.617,1.501-1.617C16.393,2.595,17,3.317,17,4.212v11.124
                            c0,0.892-0.607,1.614-1.499,1.614c-0.894,0-1.501-0.722-1.501-1.614V4.212z"/>
        <path fill="#FFFFFF" d="M16.001,27.817c-6.244,0-11.321-5.08-11.321-11.321c0-4.049,2.188-7.817,5.711-9.831
                            c0.772-0.441,1.761-0.173,2.203,0.6c0.444,0.775,0.174,1.761-0.6,2.206c-2.519,1.441-4.083,4.133-4.083,7.025
                            c0,4.462,3.629,8.09,8.09,8.09c4.459,0,8.091-3.628,8.091-8.09c0-2.892-1.567-5.584-4.086-7.025
                            c-0.773-0.444-1.043-1.431-0.599-2.206c0.444-0.773,1.43-1.044,2.203-0.6c3.523,2.014,5.711,5.782,5.711,9.831
                            C27.32,22.737,22.243,27.817,16.001,27.817L16.001,27.817z"/>
        </g>
    </svg>
    <div id="toolbar">
      <div class="exits">
        <i>js+</i><!--
        --><a href="https://coq.inria.fr"><!--
          --><img src="https://coq.inria.fr/files/barron_logo.png" alt="Coq" height="35" style="vertical-align: middle">
        </a>
        <!-- 
        <a href="http://feever.fr/" target="_blank">
          <img src="${base_path}/ui-images/feever-logo.png" alt="FEEVER Logo" height="34" width="67"
               style="vertical-align: middle"/>
        </a>
        -->
      </div> <!-- /.exits -->
      <span id="buttons">
        <button name="up"          alt="Up (Meta-P)"             title="Up (Meta-P)"></button><!--
     --><button name="down"        alt="Down (Meta-N)"           title="Down (Meta-N)"></button>
        <button name="to-cursor"   alt="To cursor (Meta-Enter)"  title="To cursor (Meta-Enter)"></button>
        <button name="reset"       alt="Reset worker"            title="Reset worker"></button>
      </span>
      <div class="exits right">
        <a href="https://github.com/ejgallego/jscoq" class="link-to-github">Readme @</a>
      </div> <!-- /.exits -->
    </div> <!-- /#toolbar -->
    <div class="flex-container">
      <div id="goal-panel" class="flex-panel">
        <div class="caption">Goals</div>
        <div class="content" id="goal-text" data-lang="coq">
        </div>
      </div>
      <div class="msg-area flex-panel">
        <div class="caption">
          Messages
          <select name="msg_filter">
            <option value="0">Error</option>
            <option value="1">Warning</option>
            <option value="2">Notice</option>
            <option value="3" selected="selected">Info</option>
            <option value="4">Debug</option>
          </select>
        </div>
        <div class="content" id="query-panel"></div>
      </div>
      <div class="flex-panel collapsed">
        <div class="caption">Packages</div>
        <div id="packages-panel" class="content"></div>
      </div>
    </div>`;

        return html;
    }

    /**
     * Initializes the UI layout.
     * @param {object} options jsCoq options; used keys are:
     *   - wrapper_id: element id of the IDE container
     *   - base_path: URL for the root directory of jsCoq
     *   - theme: jsCoq theme to use for the panel ('light' or 'dark')
     */
    constructor(options) {

        this.options = options;

        // Our reference to the IDE, goal display & query buffer.
        this.ide   = document.getElementById(options.wrapper_id);

        this.panel = document.createElement('div');
        this.panel.id = 'panel-wrapper';
        this.panel.innerHTML = this.html(options.base_path);

        if (options.theme)
            this.panel.classList.add(`jscoq-theme-${options.theme}`);

        this.ide.appendChild(this.panel);

        // UI setup.
        this.proof    = this.panel.querySelector('#goal-text');
        this.query    = this.panel.querySelector('#query-panel');
        this.packages = this.panel.querySelector('#packages-panel');
        this.buttons  = this.panel.querySelector('#buttons');

        var flex_container = this.panel.getElementsByClassName('flex-container')[0];
        flex_container.addEventListener('click', evt => { this.panelClickHandler(evt); });

        this.panel.querySelector('#hide-panel')
            .addEventListener('click', evt => this.toggle() );

        this._setButtons(false); // starts disabled

        this.onAction = evt => {};
        this.buttons.addEventListener('click', evt => this.onAction(evt));

        // Configure log
        this.log_levels = ['Error', 'Warning', 'Notice', 'Info', 'Debug']
        $(this.panel).find('select[name=msg_filter]')
            .change(ev => this.filterLog(parseInt(ev.target.value)));
        this.filterLog(3); // Info

        this._preloadImages();
    }

    show() {
        this.ide.classList.remove('toggled');
    }

    hide() {
        this.ide.classList.add('toggled');
    }

    toggled() {
        return this.ide.classList.contains('toggled');
    }

    toggle() {
        if (this.toggled()) {
            this.show();
        }
        else {
            this.hide();
        }
    }

    splash(version_info, msg, mode='wait') {
        var above = $(this.proof).find('.splash-above'), 
            image = $(this.proof).find('.splash-image'), 
            below = $(this.proof).find('.splash-below');

        var overlay = `${this.options.base_path}/ui-images/${mode}.gif`;

        if (!(above.length && image.length && below.length)) {
            $(this.proof).empty().append(
                above = $('<p>').addClass('splash-above'),
                $('<div>').addClass('splash-middle').append(
                    image = $('<div>').append($('<img>'))
                ),
                below = $('<p>').addClass('splash-below')
            )
        }

        if (version_info) above.text(version_info);
        if (msg)          below.text(msg);
        
        image[0].classList = [];
        image.addClass(['splash-image', mode]);
        var img = image.find('img');
        if (img.attr('src') !== overlay) img.attr('src', overlay);
    }

    /**
     * Shows a notice in the main goal pane (reserved for important messages,
     * such as during startup).
     * @param {string} msg message text
     */
    systemNotification(msg) {
        $(this.proof).append($('<p>').addClass('system').text(msg));
    }

    _setButtons(enabled) {
        $(this.buttons).find('button').attr('disabled', !enabled);
        enabled ? this.buttons.classList.remove('disabled') 
                : this.buttons.classList.add('disabled');
    }

    toolbarOn() {
        // Enable the button actions and show them.
        this._setButtons(true);
        this.ide.classList.remove('on-hold');
    }

    toolbarOff() {
        // Disable the button actions and dim them.
        this._setButtons(false);
        this.ide.classList.add('on-hold');
    }

    // This is still not optimal.
    update_goals(content) {
        // TODO: Add diff/history of goals.
        // XXX: should send a message.
        $(this.proof).html(content);
    }

    // Add a log event received from Coq.
    log(text, level, attrs={}) {

        // Levels are taken from Coq itself:
        //   | Debug | Info | Notice | Warning | Error
        var item = $('<div>').addClass(level).html(text).attr(attrs),
            prev = $(this.query).children(':visible').last();

        if (attrs['data-coq-sid'] !== undefined)
            this.logSep(attrs['data-coq-sid'], item, prev);

        $(this.query).append(item);

        if (this.isLogVisible(level)) {
            if (this.scrollTimeout) clearTimeout(this.scrollTimeout);

            this.scrollTimeout = setTimeout( () => {
                this.query.scrollTo({top: this.query.scrollHeight, 
                                     behavior: 'smooth'});
            }, 1 );
        }

        return item;
    }

    logSep(sid, item, prev) {
        if (sid === prev.attr('data-coq-sid')) {
            prev.removeClass('coq-sid-end');
            item.addClass('coq-sid-end');
        }
        else {
            item.addClass(['coq-sid-start', 'coq-sid-end'].concat(
                prev.hasClass('coq-sid-end') ? ['coq-prev-end'] : []));
        }
    }

    /**
     * Readjusts separators for the entire log when the level changes.
     * (called from filterLog)
     */
    logSepReadjust() {
        for (let item of $(this.query).find('.coq-sid-start')) {
            // XXX not very efficient :(
            if ($(item).prevUntil(':visible').prev('.coq-sid-end:visible').length)
                $(item).addClass('coq-prev-end');
            else
                $(item).removeClass('coq-prev-end');
        }
    }

    filterLog(level_select) {
        var i;

        if (typeof level_select == 'string')
            level_select = this.log_levels.indexOf(level_select);

        console.log('setting log level', level_select);
        for(i = 0 ; i <= level_select ; i++)
            this.query.classList.add(`show-${this.log_levels[i]}`);
        for(i = level_select+1 ; i < this.log_levels.length ; i++)
            this.query.classList.remove(`show-${this.log_levels[i]}`);

        this.log_level = level_select;

        requestAnimationFrame(() => {
            this.query.scrollTo({top: this.query.scrollHeight});  // only reasonable thing to do
            this.logSepReadjust();
        });
    }

    isLogVisible(level) {
        if (typeof level == 'string')
            level = this.log_levels.indexOf(level);

        return level <= this.log_level;
    }

    panelClickHandler(evt) {

        var target = evt.target;

        if(target.classList.contains('caption') &&

            target.parentNode.classList.contains('flex-panel')) {

            var panel = target.parentNode;

            if(panel.classList.contains('collapsed')) {

                panel.classList.remove('collapsed');

            } else {

                var panels_cpt = this.panel.getElementsByClassName('flex-panel').length;
                var collapsed_panels_cpt = this.panel.getElementsByClassName('collapsed').length;

                if(collapsed_panels_cpt + 1 >= panels_cpt) // at least one panel opened
                    return;

                panel.classList.add('collapsed');
            }
        }
    }

    /**
     * Auxiliary function to improve UX by preloading images.
     */
    _preloadImages() {
        var imgs_dir = `${this.options.base_path}/ui-images`,
            img_fns = ['jscoq-splash.png', 'egg.png'];

        for (let fn of img_fns) {
            new Image().src = `${imgs_dir}/${fn}`;
        }
    }
}

// Local Variables:
// js-indent-level: 4
// End:

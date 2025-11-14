import {SearchQuery, setSearchState, findNext, findPrev, getMatchHighlights} from 'prosemirror-search'
import {activeDocument, activeView} from './registry';
import { activateSearchCallback, deactivateSearchCallback, searchedCallback } from './markup';

/**
 * The Searcher class lets us find text ranges that match a search string within the editor element.
 * 
 * The searcher uses the ProseMirror search plugin https://github.com/proseMirror/prosemirror-search to create 
 * and track ranges within the doc that match a given SearchQuery.
 * 
 * Note that `isActive` and intercepting Enter/Shift-Enter is only relevant in the Swift case, where the search 
 * bar is implemented in Swift.
 */
export class Searcher {
    
    constructor() {
        this._searchString = null;      // what we are searching for
        this._direction = 'forward';    // direction we are searching in
        this._caseSensitive = false;    // whether the search is case sensitive
        this._forceIndexing = true;     // true === rebuild foundRanges before use; false === use foundRanges\
        this._searchQuery = null        // the SearchQuery we use
        this._isActive = false;         // whether we are in "search mode", intercepting Enter/Shift-Enter
        this._matchCount = null;        // the current number of matches, null when not active
        this._matchIndex = null;        // the index into matches we are at in the current search, null when not active
    };
    
    /**
     * Select and return the selection.from and selection.to in the direction that matches text.
     * 
     * In Swift, the text is passed with smartquote nonsense removed and '&quot;'
     * instead of quotes and '&apos;' instead of apostrophes, so that we can search on text
     * that includes them and pass them from Swift to JavaScript consistently.
     */
    searchFor(text, direction='forward', searchOnEnter=false) {
        const view = activeView()
        let command = this.searchForCommand(text, direction, searchOnEnter);
        return command(view.state, view.dispatch, view);
    };

    /**
     * Return a command that will execute a search, typically assigned as a button action.
     * @param {string}                  text            The text to search for.
     * @param {'forward' | 'backward'}  direction       The direction to search in.
     * @param {boolean}                 searchOnEnter   Whether to begin intercepting Enter in the view until cancelled.
     * @returns {Command}                               A command that will execute a search for text given the state, dispatch, and view.
     */
    searchForCommand(text, direction='forward', searchOnEnter=false) {
        const commandAdapter = (state, dispatch, view) => {
            let result = {};
            if (!text || (text.length === 0)) {
                this.cancel()
                return result;
            }
            // On the Swift side, we replace smart quotes and apostrophes with &quot; and &apos;
            // before getting here, but when doing searches in markupeditor-base, they will come 
            // in here unchanged. So replace them with the proper " or ' now.
            text = text.replaceAll('’', "'")
            text = text.replaceAll('‘', "'")
            text = text.replaceAll('“', '"')
            text = text.replaceAll('”', '"')
            text = text.replaceAll('&quot;', '"')       // Fix the hack for quotes in the call
            text = text.replaceAll('&apos;', "'")       // Fix the hack for apostrophes in the call

            // Rebuild the query if forced or if the search string changed
            if (this._forceIndexing || (text !== this._searchString)) {
                this._searchString = text;
                this._isActive = searchOnEnter
                this._buildQuery();
                const transaction = setSearchState(view.state.tr, this._searchQuery);
                view.dispatch(transaction);             // Show all the matches
                this._setMatchCount(view.state);
                this._forceIndexing = false;
            };

            // Search for text and return the result containing from and to that was found
            //
            // TODO: Fix bug that occurs when searching for next or prev when the current selection 
            //          is unique within the doc. The `nextMatch` in prosemirror-search when failing,  
            //          should set the to value to `Math.min(curTo, range.to))` or it misses the 
            //          existing selection. Similarly on `prevMatch`. This needs to be done in a 
            //          patch of prosemirror-search. For example:
            //
            //  function nextMatch(search, state, wrap, curFrom, curTo) {
            //      let range = search.range || { from: 0, to: state.doc.content.size };
            //      let next = search.query.findNext(state, Math.max(curTo, range.from), range.to);
            //      if (!next && wrap)
            //          next = search.query.findNext(state, range.from, Math.min(curTo, range.to));
            //      return next;
            //  }

            result = this._searchInDirection(direction, view.state, view.dispatch);
            if (!result.from) {
                this.deactivate(view);
            } else {
                let increment = (direction == 'forward') ? 1 : -1;
                let index = this._matchIndex + increment;
                let total = this._matchCount;
                let zeroIndex = index % total;
                this._matchIndex = (zeroIndex <= 0) ? total : zeroIndex;
                this._direction = direction;
                if (searchOnEnter) { this._activate(view) };    // Only intercept Enter if searchOnEnter is explicitly passed as true
            }
            return result;
        };

        return commandAdapter;
    };

    _setMatchCount(state) {
        this._matchCount = getMatchHighlights(state).find().length;
        this._matchIndex = 0;
    }

    get matchCount() {
        return this._matchCount;
    }

    get matchIndex() {
        return this._matchIndex;
    }
    
    /**
     * Reset the query by forcing it to be recomputed at find time.
     */
    _resetQuery() {
        this._forceIndexing = true;
    };
    
    /**
     * Return whether search is active, and Enter should be interpreted as a search request
     */
    get isActive() {
        return this._isActive;
    };

    get caseSensitive() {
        return this._caseSensitive;
    }

    set caseSensitive(value) {
        this._caseSensitive = value;
    }
    
    /**
     * Activate search mode where Enter is being intercepted
     */
    _activate(view) {
        this._isActive = true;
        view.dom.classList.add("searching");
        activateSearchCallback(activeDocument());
    }
    
    /**
     * Deactivate search mode where Enter is being intercepted
     */
    deactivate(view) {
        if (this.isActive) deactivateSearchCallback(view.dom.getRootNode());
        view.dom.classList.remove("searching");
        this._isActive = false;
        this._searchQuery = new SearchQuery({search: "", caseSensitive: this._caseSensitive});
        const transaction = setSearchState(view.state.tr, this._searchQuery);
        view.dispatch(transaction);
        this._matchCount = null;
        this._matchIndex = null;
    }
    
    /**
     * Stop searchForward()/searchBackward() from being executed on Enter. Force reindexing for next search.
     */
    cancel() {
        const view = activeView()
        this.deactivate(view)
        this._resetQuery();
    };
    
    /**
     * Search forward (might be from Enter when isActive).
     */
    searchForward() {
        const view = activeView()
        return this._searchInDirection('forward', view.state, view.dispatch);
    };
    
    /*
     * Search backward (might be from Shift+Enter when isActive).
     */
    searchBackward() {
        const view = activeView()
        return this._searchInDirection('backward', view.state, view.dispatch);
    }
    
    /*
     * Search in the specified direction.
     */
    _searchInDirection(direction, state, dispatch) {
        const view = activeView()
        if (this._searchString && (this._searchString.length > 0)) {
            if (direction == "forward") { findNext(state, dispatch)} else { findPrev(state, dispatch)};
            searchedCallback(activeDocument())
            // Return the selection from and to from the view, because that is what changed
            return {from: view.state.tr.selection.from, to: view.state.tr.selection.to};
        };
        return {}
    };

    /**
     * Create a new SearchQuery and highlight all the matches in the document.
     */
    _buildQuery() {
        this._searchQuery = new SearchQuery({search: this._searchString, caseSensitive: this._caseSensitive});
    }

};
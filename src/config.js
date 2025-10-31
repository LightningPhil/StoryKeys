/**
 * @file config.js
 * @description Central configuration file for the StoryKeys application.
 */

export const config = {
    // Number of lessons to display per page in the lesson picker
    LESSONS_PER_PAGE: 20,

    // The default sorting option for the lesson picker
    DEFAULT_SORT_KEY: 'title',

    // How many recent sessions to consider for weighting the randomiser
    // The randomiser will try to avoid picking lessons from this many recent sessions.
    RANDOMISER_HISTORY_LENGTH: 15,
};
Currently, I’m facing a data synchronization issue in my application.

Problem
I open the application in Browser 1 and add a new entry.
Then I open the same application in Browser 2 and refresh the page.
After refreshing Browser 2, the entry that I added from Browser 1 gets cleared/disappears from Browser 1 as well.
The newly added data should persist and should not be removed when another browser refreshes.
Expected Behavior

The data should be properly persisted on the backend/database and synchronized across multiple browser sessions.

For example:

Add Entry A from Browser 1.
Refresh Browser 2.
Entry A should still exist in Browser 1.
Browser 2 should also show Entry A after refreshing.
Refreshing or updating one browser should never overwrite or clear existing data created from another browser/session.

Please investigate the root cause, especially around API requests, database persistence, state management, local storage/session storage, and update/overwrite logic. Fix the issue without breaking the existing functionality.
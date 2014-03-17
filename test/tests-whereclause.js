﻿///<reference path="run-unit-tests.html" />


(function () {

    var db = new Dexie("TestDB-WhereClause");
    db.version(1).schema({
        folders: "++id,&path",
        files: "++id,filename,extension,folderId"
    });

    var Folder = db.folders.defineClass({
        id: Number,
        path: String,
        description: String
    });

    var File = db.files.defineClass({
        id: Number,
        filename: String,
        extension: String,
        folderId: Number
    });

    File.prototype.getFullPath = function (trans) {
        var file = this;
        return (trans || db).folders.get(this.folderId, function (folder) {
            return folder.path + "/" + file.filename + (file.extension || "");
        });
    }

    db.on("populate", function(trans) {
        var folders = trans.table("folders");
        var files = trans.table("files");
        folders.add({path: "/", description: "Root folder"});
        folders.add({path: "/usr"});
        folders.add({path: "/usr/local"});
        folders.add({ path: "/usr/local/bin" }).then(function (id) {
            files.add({filename: "Hello", folderId: id});
            files.add({filename: "hello", extension: ".exe", folderId: id});
        });
        folders.add({ path: "/usr/local/src" }).then(function (id) {
            files.add({filename: "world", extension: ".js", folderId: id});
            files.add({filename: "README", extension: ".TXT", folderId: id});
        });
        folders.add({ path: "/usr/local/var" });
        folders.add({ path: "/USR/local/VAR" });
        folders.add({path: "/var"});
        folders.add({ path: "/var/bin" }).then(function (id) {
            files.add({filename: "hello-there", extension: ".exe", folderId: id});
        });
    });

    module("WhereClause", {
        setup: function () {
            stop();
            db.delete().then(function () {
                db.open().error(function (e) {
                    throw "Error opening database: " + e;
                }).ready(start);
                
            }).catch(function (e) {
                throw "Could not delete database: " + e;
            });
        },
        teardown: function () {
            db.delete();
        }
    });


    asyncTest("equalsAnyOf()", function () {
        var trans = db.transaction("r", db.files, db.folders);

        trans.files.where("filename").equalsAnyOf("hello", "hello-there", "README", "gösta").toArray(function (a) {
            equal(a.length, 3, "Should find 3 files");
            equal(a[0].filename, "README", "First match is README because capital R comes before lower 'h' in lexical sort");
            equal(a[1].filename, "hello", "Second match is hello");
            equal(a[2].filename, "hello-there", "Third match is hello-there");

            a[0].getFullPath(trans).then(function (fullPath) {
                equal(fullPath, "/usr/local/src/README.TXT", "Full path of README.TXT is: " + fullPath);
            });
            a[1].getFullPath(trans).then(function (fullPath) {
                equal(fullPath, "/usr/local/bin/hello.exe", "Full path of hello.exe is: " + fullPath);
            });
            a[2].getFullPath(trans).then(function (fullPath) {
                equal("/var/bin/hello-there.exe", fullPath, "Full path of hello-there.exe is: " + fullPath);
            });
        });

        trans.complete(start);
        trans.error(function(e){
            ok(false, "Error: " + e);
            start();
        });
    });

    asyncTest("equalsIgnoreCase()", function () {

        db.files.where("filename").equalsIgnoreCase("hello").toArray(function (a) {
            equal(a.length, 2, "Got two files");
            equal(a[0].filename, "Hello", "First file is Hello");
            equal(a[1].filename, "hello", "Second file is hello");
            start();
        });

    });

    asyncTest("equalsIgnoreCase() 2", function () {
        var folder = new Folder();
        folder.path = "/etc";
        folder.description = "Slasktratten";
        db.folders.add(folder).then(function (folderId) {
            var filenames = ["", "\t ", "AA", "AAron", "APAN JAPAN", "APAN japaö", "APGALEN", "APaLAT", "APaÖNSKAN", "APalster",
					"Aaron", "Apan JapaN", "Apan Japaa", "Apan Japan", "Gösta",
					"apan JA", "apan JAPA", "apan JAPAA", "apan JAPANer",
					"apan JAPAÖ", "apan japan", "apan japanER", "östen"];

            var files = filenames.map(function (filename) {
                var file = new File();
                file.filename = filename;
                file.folderId = folderId;
                return file;
            });

            var trans = db.transaction("rw", db.files);
            files.forEach(function (file) {
                trans.files.add(file);
            });

            trans.files.where("filename").equalsIgnoreCase("apan japan").toArray(function (a) {
                equal(a.length, 4, "There should be 4 files with that name");
                equal(a[0].filename, "APAN JAPAN", "APAN JAPAN");
                equal(a[1].filename, "Apan JapaN", "Apan JapaN");
                equal(a[2].filename, "Apan Japan", "Apan Japan");
                equal(a[3].filename, "apan japan", "apan japan");
            });

            trans.complete(start);
            trans.error(function (e) {
                ok(false, "Error: " + e);
                start();
            });
        }).catch(function (e) {
            ok(false, e);
            start();
        });
    });

    asyncTest("equalsIgnoreCase() 2 descending", function () {
        var folder = new Folder();
        folder.path = "/etc";
        folder.description = "Slasktratten";
        db.folders.add(folder).then(function (folderId) {
            var filenames = ["", "\t ", "AA", "AAron", "APAN JAPAN", "APAN japaö", "APGALEN", "APaLAT", "APaÖNSKAN", "APalster",
					"Aaron", "Apan JapaN", "Apan Japaa", "Apan Japan", "Gösta",
					"apan JA", "apan JAPA", "apan JAPAA", "apan JAPANer",
					"apan JAPAÖ", "apan japan", "apan japanER", "östen"];

            var files = filenames.map(function (filename) {
                var file = new File();
                file.filename = filename;
                file.folderId = folderId;
                return file;
            });

            var trans = db.transaction("rw", db.files);
            files.forEach(function (file) {
                trans.files.add(file);
            });

            trans.files
                .where("filename").equalsIgnoreCase("apan japan")
                .and(function (f) { return f.folderId === folderId }) // Just for fun - only look in the newly created /etc folder.
                .desc()
                .toArray(function (a) {
                    equal(a.length, 4, "There should be 4 files with that name in " + folder.path);
                    equal(a[0].filename, "apan japan", "apan japan");
                    equal(a[1].filename, "Apan Japan", "Apan Japan");
                    equal(a[2].filename, "Apan JapaN", "Apan JapaN");
                    equal(a[3].filename, "APAN JAPAN", "APAN JAPAN");
                });

            trans.complete(start);
            trans.error(function (e) {
                ok(false, "Error: " + e);
                start();
            });
        });
    });

    asyncTest("equalsIgnoreCase() 3 (first key shorter than needle)", function () {
        var t = db.transaction("rw", db.files);
        t.files.clear();
        t.files.add({ filename: "Hello-there-", folderId: 1 });
        t.files.add({ filename: "hello-there-", folderId: 1 });
        t.files.add({ filename: "hello-there-everyone", folderId: 1 });
        t.files.add({ filename: "hello-there-everyone-of-you!", folderId: 1 });
        // Ascending
        t.files.where("filename").equalsIgnoreCase("hello-there-everyone").toArray(function (a) {
            equal(a.length, 1, "Should find one file");
            equal(a[0].filename, "hello-there-everyone", "First file is " + a[0].filename);
        });
        // Descending
        t.files.where("filename").equalsIgnoreCase("hello-there-everyone").desc().toArray(function (a) {
            equal(a.length, 1, "Should find one file");
            equal(a[0].filename, "hello-there-everyone", "First file is " + a[0].filename);
        });
        t.on("complete", start);
        t.on("error", function (e) {
            ok(false, e);
        });
    });

    asyncTest("startsWithIgnoreCase()", function () {
        var t = db.transaction("r", db.folders);

        t.folders.count(function (count) {
            ok(true, "Number of folders in database: " + count);
            t.folders.where("path").startsWithIgnoreCase("/").toArray(function (a) {
                equal(a.length, count, "Got all folder objects because all of them starts with '/'");
            });
        });

        t.folders.where("path").startsWithIgnoreCase("/usr").toArray(function (a) {
            equal(a.length, 6, "6 folders found: " + a.map(function(folder){return '"' + folder.path + '"'}).join(', '));
        });

        t.complete(function () {
            ok(true, "Transaction complete");
            start();
        }).error(function (e) {
            ok(false, e);
            start();
        });
    });

})();
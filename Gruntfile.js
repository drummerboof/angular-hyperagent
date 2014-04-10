module.exports = function(grunt) {

    require('load-grunt-tasks')(grunt);

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        karma: {
            unit: {
                configFile: 'karma.conf.js'
            }
        },

        concat: {
            options: {
                // define a string to put between each file in the concatenated output
                separator: ';'
            },
            dist: {
                // the files to concatenate
                src: ['src/hyperagent.js', 'src/*.js'],
                // the location of the resulting JS file
                dest: 'dist/<%= pkg.name %>.js'
            }
        }

    });

    grunt.loadNpmTasks('grunt-contrib-concat');

    grunt.registerTask('build', [
        'concat'
    ]);

    grunt.registerTask('test', [
        'concat',
        'karma:unit'
    ]);

};
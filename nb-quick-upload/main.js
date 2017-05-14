define(['require',
    'base/js/namespace',
    'base/js/events',
    'components/backbone/backbone-min'
], function(require, Jupyter, Events, Backbone) {

  var cell_ids = [];
  var button;
  var popover;
  var submission_text;

  var submission_template = _.template('' +
    '<form class="quickupload-submission">' +
      '<div class="form-group">' +
        '<textarea name="quickupload-desc" class="form-control" rows="3" placeholder="Write a description to be posted along with your code"></textarea>' +
      '</div>' +
      '<div class="quickupload-submit">' +
        '<% if (cell_ids.length === 0) { %>' +
          '<span class="label selected-cells label-default">Click cells to only upload selection</span>' +
          '<input type="submit" class="btn btn-primary" value="Create gist">' +
        '<% } else { %>' +
          '<span class="label selected-cells label-info"><%= cell_ids.length %> cells selected</span>' +
          '<input type="submit" class="btn btn-warning" value="Create gist">' +
        '<% } %>' +
      '</div>' +
    '</form>')

  var post_save_template = _.template('<p><a class="btn btn-info" href="<%= url %>" target="_blank">View on GitHub</a></p>')

  function set_popover_content (content) {
    var closer = $('<button type="button" class="close quickupload-close">' +
                    '<span aria-hidden="true">&times;</span></button>' +
                   '</span>')
      .click(cleanup);

    if(!popover || !popover.is(":visible")) {
      button.popover('show')
      popover = button.data("bs.popover").$tip
      popover.find(".popover-title").append(closer)
    }

    popover.find(".popover-content").html(content)
  }

  function ask_for_details () {  
    if(popover) {
      submission_text = popover.find('textarea').val()
    }
    var content = $(submission_template({ cell_ids: cell_ids }));
    
    set_popover_content(content)

    popover.find('textarea').val(submission_text)

    content.find('textarea')
      .on('focus', function () {
        if (Jupyter.notebook.keyboard_manager) {
          Jupyter.notebook.keyboard_manager.disable()
        }
      })
      .on('blur', function () {
        if (Jupyter.notebook.keyboard_manager) {
          Jupyter.notebook.keyboard_manager.enable()
        }
      })
      .on('keydown', function () {
        submission_text = $(this).val()
      })

    content.submit(function() {
      set_popover_content("<p><i class='fa fa-circle-o-notch fa-spin'></i> Saving...</p>")
      submit();
      cell_ids = [];
      return false;
    })
  }

  function fake_notebook () {
    var notebook = Jupyter.notebook;

    // remove the conversion indicator, which only belongs in-memory
    delete notebook.metadata.orig_nbformat;
    delete notebook.metadata.orig_nbformat_minor;

    var cells = notebook.get_cells().filter(function(cell) {
      return cell_ids.length === 0 ? true : cell_ids.indexOf(cell.cell_id) != -1
    });

    var ncells = cells.length;
    var cell_array = cells.map(function(cell) {
      return cell.toJSON(true)
    })

    var data = {
        cells: cell_array,
        metadata: notebook.metadata,
        nbformat: notebook.nbformat,
        nbformat_minor: notebook.nbformat_minor
    };

    return data;
  }

  function cell_selected (e, target) {
    var element = $(target.cell.element).toggleClass("quickupload-selected")
    var id = target.cell.cell_id;

    if(element.hasClass("quickupload-selected")) {
      cell_ids.push(id);
    } else {
      var index = cell_ids.indexOf(id);
      if (index > -1) {
          cell_ids.splice(index, 1);
      }
    }
    ask_for_details();
  }

  function cleanup () {
    button.popover('hide')
    $(".quickupload-selected").removeClass("quickupload-selected")
    cell_ids = [];
    Events.off('select.Cell', cell_selected)
  }

  function start () {
    ask_for_details();
    cell_ids = [];
    Events.on('select.Cell', cell_selected)
  }

  function submit () {
    var fakebook = fake_notebook();
    
    var data = {
      'description': 'Uploaded from a Jupyter Notebook with with NB Quick Upload',
      'public': false,
      'files': {
        'notebook.ipynb': {
          'content': JSON.stringify(fakebook)
        }
      }
    }

    if(submission_text && submission_text != "") {
      data['files']['README.md'] = { 'content': submission_text }
    }

    submission_text = "";

    jQuery.ajax ({
      url: "https://api.github.com/gists",
      type: "POST",
      data: JSON.stringify(data),
      dataType: "json",
      contentType: "application/json; charset=utf-8",
      success: function(result){
        var content = post_save_template({ url:result.html_url })
        set_popover_content(content)
      }
    });

  }

  function add_start_handler () {
    var action = {
      icon: 'fa-cloud-upload', // a font-awesome class used on buttons, etc
      help    : 'Show an alert',
      help_index : 'zz',
      handler : start
    };

    var full_action_name = Jupyter.actions.register(action, 'start-selecting', 'quickupload'); // returns 'my_extension:show-alert'

    button = Jupyter.toolbar.add_buttons_group([full_action_name]);
    button.popover({
      placement: 'bottom',
      html: true,
      trigger: 'manual',
      content: "<p>Sample content</p>",
      title: "Quick upload"
    })
    document.button = button
  }

  function load_ipython_extension () {
    load_css('./style.css')
    add_start_handler();
  }

  function load_css (name) {
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = require.toUrl(name);
    document.getElementsByTagName("head")[0].appendChild(link);
  };

  return {
    load_ipython_extension: load_ipython_extension
  };
});

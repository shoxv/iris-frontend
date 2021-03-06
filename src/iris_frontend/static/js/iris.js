/*
  Copyright (c) LinkedIn Corporation. All rights reserved. Licensed under the BSD-2 Clause license.
  See LICENSE in the project root for license information.
*/

window.iris = window.iris || {}; //define iris app obj

iris = {
  data: {tableEntryLimit: 500},
  init: function(){
    $.fn.dataTableExt.classes.sLengthSelect = "form-control border-bottom";
    window.addEventListener('popstate', this.route.bind(this));
    this.registerHandlebarHelpers();
    $('.main').tooltip({
      selector: '[data-toggle="tooltip"]'
    });
    this.route();
  },
  route: function() {
    // break path into segments and route
    var path = window.location.pathname;
    var start = 0;
    var end = path.length - 1;
    if (path.indexOf('/') == start) {
      start++;
    }
    if (path.lastIndexOf('/') == end) {
      end--;
    }
    path = path.substr(start, end);
    var segments = path.split('/');
    switch (segments.length) {
      case 1:
          this[segments[0]].init();
        break;
      case 2:
          this[segments[0].slice(0, -1)].init();
        break;
    }
  },
  changeTitle: function(title) {
    window.document.title = (title ? title + ' - ' : '') + 'Iris';
  },
  plans: {
    initialized: false,
    data: {
      url: '/api/v0/plans',
      $page: $('.main'),
      $table: $('#plans-table'),
      $filterForm: $('#filter-form'),
      tableTemplate: $('#plans-table-template').html(),
      DataTable: null,
      dataTableOpts: {
        orderClasses: false,
        order: [[2, 'desc']],
        columns: [
          { width: '40%' },
          null,
          null,
          null
        ]
      }
    },
    init: function(){
      iris.changeTitle('Plans');
      var self = this;
      if (this.initialized == false) {
        this.initFilters();
        this.events();
        this.initialized = true;
      }
      iris.tables.filterTable.call(this);
    },
    events: function(){
      var data = this.data,
          $table = data.$table,
          $page = data.$page;

      $table.on('click', 'tbody tr[data-route]', function(e){
        if (e.target.tagName !== 'A') {
          if ((e.ctrlKey || e.metaKey)) {
            window.open($(this).attr('data-route'));
          } else {
            window.location = $(this).attr('data-route');
          }
        }
      });
      data.$filterForm.on('submit', iris.tables.filterTable.bind(this));

      //javascript live filtering if needed
      // $page.find('#filter-name').on('keyup', function(){
      //   data.DataTable.column('.name').search($(this).val()).draw();
      // });
      // $page.find('#filter-creator').on('keyup', function(){
      //   data.DataTable.column('.creator').search($(this).val()).draw();
      // });
      // $page.find('#filter-active').on('change', function(){
      //   var state = $(this).prop('checked');
      //   if (state) {
      //     data.DataTable.column('.active').search(state).draw();
      //   } else {
      //     data.DataTable.column('.active').search(state).draw();
      //   }
      // });
    },
    getData: function(params){
      var self = this;
      params['limit'] = iris.data.tableEntryLimit;
      return $.getJSON(this.data.url, params).fail(function(){
        iris.createAlert('No plans found');
      });
    },
    initFilters: function(){
      iris.typeahead.init('user');
      $('.datetimepicker').datetimepicker({
        showClose: true
      });
    }
  }, //end iris.plans
  plan: {
    data: {
      url: '/api/v0/plans/',
      $page: $('.plan-details'),
      pageTemplateSource: $('#plan-module-template').html(),
      notificationTemplateSource: $('#plan-notification-template').html(),
      stepTemplateSource: $('#plan-step-template').html(),
      trackingTemplateSource: $('#plan-tracking-notification-template').html(),
      addNotificationBtn: '.plan-notification-add',
      removeNotificationBtn: '.plan-notification-remove',
      planNotificationInputs: '.plan-notification input, .plan-notification select',
      addStepBtn: '#add-step',
      addTrackingTemplateBtn: '#add-tracking-template',
      removeStepBtn: '.remove-step',
      removeTrackingTemplateBtn: '.remove-tracking-template',
      createPlanBtn: '#publish-plan',
      clonePlanBtn: '#clone-plan',
      showTestPlanModalBtn: '#test-plan-modal-btn',
      testPlanBtn: '#test-plan',
      versionSelect: '.version-select',
      activatePlan: '.badge[data-active="0"]',
      viewRelated: '.view-related',
      relatedPlans: [],
      aggregationBtn: '#aggregation h4',
      trackingType: '#tracking-type',
      trackingKey: '#tracking-key',
      trackingTemplateBtn: '#tracking-notification[data-view="false"] .tracking-inner h4',
      template: null,
      ajaxResponse: null,
      submitModel: {},
      blankModel: {
        priorities: window.appData.priorities,
        availableTemplates: [],
        aggregation_reset: 300,
        aggregation_window: 300,
        threshold_count: 10,
        threshold_window: 900,
        count: 1,
        steps: [[{count: 1}]]
      },
      blankTrackingTemplateModel: {
        applications: window.appData.applications,
        viewMode: false,
        tracking_template: {
          application: {
            email_subject: "",
            email_text: "",
            email_html: "",
          }
        }
      }
    },
    init: function(){
      var location = window.location.pathname.split('/'),
          path = this.data.path = location[location.length - 1],
          self = this;

      Handlebars.registerPartial('plan-step', $('#plan-step-template').html());
      Handlebars.registerPartial('plan-notification', $('#plan-notification-template').html());
      Handlebars.registerPartial('plan-tracking-notification', this.data.trackingTemplateSource);
      this.getPlan(path).done(function(){
        self.events();
        iris.versionTour.init();
      });
      this.drag.init();
      iris.typeahead.init();
    },
    events: function(){
      var data = this.data;
      data.$page.on('click', data.addNotificationBtn, this.addNotification.bind(this));
      data.$page.on('click', data.removeNotificationBtn, this.removeNotification);
      data.$page.on('click', data.removeStepBtn, this.removeStep);
      data.$page.on('click', data.removeTrackingTemplateBtn, this.removeTrackingTemplate);
      data.$page.on('click', data.addStepBtn, this.addStep.bind(this));
      data.$page.on('click', data.addTrackingTemplateBtn, this.addTrackingTemplate.bind(this));
      $(data.createPlanBtn).on('click', this.createPlan.bind(this));
      data.$page.on('click', data.clonePlanBtn, this.clonePlan.bind(this));
      $(data.testPlanBtn).on('click', this.testPlan.bind(this));
      data.$page.on('click', data.showTestPlanModalBtn, this.testPlanModal.bind(this));
      data.$page.on('change', data.planNotificationInputs, this.updateValues);
      data.$page.on('click', data.aggregationBtn, this.toggleAggregation);
      data.$page.on('click', data.trackingTemplateBtn, this.toggleTrackingTemplate);
      data.$page.on('click', data.activatePlan, this.activatePlan.bind(this));
      data.$page.on('change', data.versionSelect, this.loadVersion.bind(this));
      data.$page.on('change', data.trackingType, this.updateTrackingPlaceholder.bind(this));
      window.onbeforeunload = iris.unloadDialog.bind(this);
    },
    getPlan: function(plan){
      var self = this,
          template = this.data.template = Handlebars.compile(this.data.pageTemplateSource);

        //create list of templates available for plans.
        for (var i = 0, item; i < window.appData.templates.length; i++) {
          item = window.appData.templates[i];
          if (item.active){
            self.data.blankModel.availableTemplates.push(item.name);
          }
        }
        self.data.blankModel.availableTemplates.sort(function(a,b){
          var a = a.toLowerCase(),
              b = b.toLowerCase();

          if (a < b) {
            return -1;
          } else if (a > b) {
            return 1;
          } else {
            return 0;
          }
        });

        //if path is new, render in edit mode.
        if (plan === 'new') {
          self.data.$page.html(template(self.data.blankModel));
          iris.changeTitle('New Plan');
          return $.Deferred().resolve();
        } else {
          self.data.viewMode = true;
          return $.getJSON(this.data.url + plan).done(function(response){
            self.data.id = response.id;
            self.data.name = response.name;
            self.data.ajaxResponse = response; //set response in root object for clone plan functionality.
            response.viewMode = self.data.viewMode;
            response.availableTemplates = self.data.blankModel.availableTemplates;
            //convert 'repeat' field to 'count' for frontend
            for (i = 0; i < response.steps.length; i++) {
              for (j = 0; j < response.steps[i].length; j++) {
                response.steps[i][j].count = response.steps[i][j].repeat + 1;
              }
            }
            self.data.$page.html(template(response));
            self.loadVersionSelect();
            iris.changeTitle('Plan ' + response.name);
          }).fail(function(){
            iris.createAlert('"' + plan +'" plan not found. <a href="/plans/new">Create a new plan.</a>');
          });
        }
    },
    toggleAggregation: function(){
      $(this).parents('#aggregation').toggleClass('active');
    },
    toggleTrackingTemplate: function(){
      $('#tracking-notification').toggleClass('active');
    },
    clonePlan: function(){
      var response = this.data.ajaxResponse;
      response.viewMode = false;
      response.templates = window.appData.templates;
      response.priorities = window.appData.priorities;
      response.applications = window.appData.applications;
      this.data.$page.html(this.data.template(response));
      iris.typeahead.init();
    },
    testPlanModal: function() {
      var
          $modal = $('#test-plan-modal'),
          $applicationSelect = $modal.find('select'),
          frag = '';
      window.appData.applications.forEach(function(app) {
        frag += ['<option>', app['name'], '</option>'].join('');
      })
      $applicationSelect.html(frag)
      $modal.modal();
    },
    testPlan: function() {
      var
          $modal = $('#test-plan-modal'),
          $application = $modal.find('select').val(),
          $context = JSON.parse(window.appData.applications.filter(function(l) {return l.name === $application})[0]['sample_context']) || {};
      $.ajax({
          url: '/api/v0/incidents',
          data: JSON.stringify({
            application: $application,
            context: $context,
            plan: this.data.name
          }),
          method: 'POST',
          contentType: 'application/json'
      }).done(function(r) {
        window.location = '/incidents/' + r
      }).fail(function(r) {
        iris.createAlert('Failed creating test incident: ' + r.responseJSON['title'])
      }).always(function() {
        $modal.modal('hide');
      })
    },
    loadVersionSelect: function(){
      var $select = $(this.data.versionSelect),
          self = this,
          frag = '';

      $.ajax({
        url: this.data.url,
        data: {
          name: this.data.name,
          fields: ['id', 'created', 'creator']
        },
        traditional: true
      }).done(function(r){
        r = r.reverse();
        for (var i = 0; i < r.length; i++) {
          var entry = r[i];
          frag += [
            '<option ', ((entry.id === self.data.id) ? 'selected' : ''),
            ' value="', entry.id,
            '" data-id="', entry.id + '">',
            'ID ', entry.id, ' - ',
            moment.unix(entry.created).local().format('YYYY/MM/DD HH:mm:ss [GMT]ZZ'),
            ' by ', entry.creator,
            ' </option>'
          ].join('');
        }
        $select.append(frag);
      });
    },
    loadVersion: function(e){
      var versionId = $(e.target).find('option:selected').attr('data-id');
      this.getPlan(versionId);
      window.history.pushState(null, null, versionId); //update url bar for refreshes
    },
    activatePlan: function(e){
      var $el = $(e.target);
      $el.addClass('disabled');
      $.ajax({
          url: this.data.url + this.data.id,
          data: JSON.stringify({active: 1}),
          method: 'POST',
          contentType: 'application/json'
      }).done(function(r){
        $el.attr('data-active', 1);
      }).fail(function(){
        iris.createAlert('Failed to activate.');
      }).always(function(){
        $el.removeClass('disabled');
      });
    },
    updateValues: function(){
      var $this = $(this);
      //Update selected attribute in the DOM on change. This is needed for drag & drop to copy over attribute states.
      if ( $this.is('select') ) {
        $('option:selected', this).attr('selected',true).siblings().removeAttr('selected');
      }

      if ($this.is('select[data-type="role"]')) {
        $this.parents('.plan-notification').find('input[data-type="target"]').val('').attr('placeholder', $this.find('option:selected').attr('data-url-type') + ' name');
        iris.typeahead.init();
      }

      $this.attr('value', $this.val());
    },
    addNotification: function(event){
      var $step = $(event.target).parents('.plan-step'),
          template = Handlebars.compile(this.data.notificationTemplateSource);

      $step.find('.plan-notification-add').before(template(this.data.blankModel));
      //re-init typeahead
      iris.typeahead.init();
    },
    removeNotification: function(){
      $(this).parents('.plan-notification').remove();
    },
    addStep: function(){
      var template = Handlebars.compile(this.data.stepTemplateSource);
      $(this.data.addStepBtn).before(template());
    },
    addTrackingTemplate: function(){
      var template = Handlebars.compile(this.data.trackingTemplateSource);
      $(this.data.addTrackingTemplateBtn).before(template(this.data.blankTrackingTemplateModel));
    },
    removeStep: function(){
      $(this).parents('.plan-step').remove();
    },
    removeTrackingTemplate: function(){
      $(this).parents('.tracking-template-step').remove();
    },
    updateSubmitModel: function(){
      // gets & checks data from plan inputs and prepares model for post.
      var model = this.data.submitModel,
          self = this,
          missingFields = [],
          $trackingEl = $('#tracking-notification.active');

      model.creator = window.appData.user;
      model.name = $('#plan-name').val();
      model.description = $('#plan-desc').val();
      model.threshold_window = parseFloat($('#threshold-window').val()) * 60;
      model.threshold_count = parseFloat($('#threshold-count').val());
      model.aggregation_window = parseFloat($('#aggregation-window').val()) * 60;
      model.aggregation_reset = parseFloat($('#aggregation-reset').val()) * 60;
      model.steps = [];
      model.isValid = true;

      // reset invalid inputs from previous check
      this.data.$page.find('.invalid-input').removeClass('invalid-input');
      this.data.$page.find('.alert-danger').remove();

      // validate model name
      if (!model.name) {
        $('#plan-name').addClass('invalid-input');
        //iris.createAlert('Missing fields: Plan name', 'danger', $('.plan-details') );
        missingFields.push('Plan name');
        model.isValid = false;
      }

      // validate plan notifications exist.
      if ($('.plan-notification').length === 0) {
        missingFields.push('steps/notifications');
        model.isValid = false;
      }

      // collect data for notifications
      $('.plan-step:has(.plan-notification)').each(function(i){
        var step = [],
            $this = $(this);

        $this.find('.plan-notification').each(function(){
          var notification = {};

          $(this).find('input:not(".tt-hint"),select,textarea').each(function(){
            var $current = $(this),
                type = $current.attr('data-type'),
                val = $current.val();

            if (!val || !$current.get(0).checkValidity()) {
              $current.addClass('invalid-input');
              //iris.createAlert('Missing fields: ' + type, 'danger', $('.plan-details') );
              missingFields.push(type);
              model.isValid = false;
            }

            val = isNaN(val) ? val : parseFloat(val);
            // convert minutes to seconds for API
            if (type === 'wait') {
              val = Math.round(val * 60);
            }
            // convert count to repeat for API
            else if (type === 'count') {
              notification['repeat'] = val - 1;
            }
            notification[type] = val;
          });
          step.unshift(notification);
        });
        model.steps.push(step);
      });

      // collect data for tracking templates

      if ($trackingEl.length) {
        if ($trackingEl.find('.template-notification').length == 0) {
            return true;
        }

        model.tracking_type = $trackingEl.find('#tracking-type').val();
        model.tracking_key = $trackingEl.find('#tracking-key').val();

        if (!model.tracking_key) {
          $trackingEl.find('#tracking-key').addClass('invalid-input');
          missingFields.push('tracking target');
          model.isValid = false;
        }

        if (!model.tracking_type) {
          $trackingEl.find('#tracking-type').addClass('invalid-input');
          missingFields.push('tracking type');
          model.isValid = false;
        }

        if ($('.tracking-template-step').length === 0) {
          missingFields.push('tracking template');
          model.isValid = false;
        }

        model.tracking_template = {};
        $trackingEl.find('.tracking-template-step').each(function(){
          var $this = $(this),
              app = $this.find('.template-application').val(),
              template = {};

          if (!app) {
            $this.find('.template-application').addClass('invalid-input');
            missingFields.push();
            model.isValid = false;
          }

          $this.find('.template-notification').each(function(){
            var $notification = $(this),
                type = $notification.attr('data-mode'),
                content = $notification.find('.notification-body').val();

            if (content) {
              template[type] = content;
            } else if ($notification.attr('data-required')) {
              $notification.find('input, textarea').addClass('invalid-input');
              missingFields.push(type);
              model.isValid = false;
            }
          });

          if (Object.keys(template).length === 0) {
            iris.createAlert('Empty tracking template for application: ' + app);
            model.isValid = false;
            $this.addClass('invalid-input');
          } else {
            model.tracking_template[app] = template;
          }

        });
      }

      if (missingFields.length > 0) {
        iris.createAlert('Missing fields: ' + missingFields.join(', '), 'danger', $('.plan-details'))
      }
    },
    createPlan: function(e){
      var model = this.data.submitModel,
          self = this,
          $button = $(e.target);
      $button.parents('.modal').modal('hide');
      this.updateSubmitModel();

      if (model && model.isValid) {
        $button.addClass('disabled');
        $.ajax({
          url: self.data.url,
          data: JSON.stringify(model),
          method: 'POST',
          contentType: 'application/json'
        }).done(function(response){
          if (response) {
            window.onbeforeunload = null; //detach confirm dialog if plan is published.
            window.location = response;
          }
        }).fail(function(response){
          var errorTxt = (response && response.responseJSON && response.responseJSON.description) ? response.responseJSON.title + ' - ' + response.responseJSON.description : 'Plan creation failed.';
          $button.removeClass('disabled');
          iris.createAlert('Error: ' + errorTxt);
        });
      }
    },
    updateTrackingPlaceholder: function(e){
      var $type = $(e.target),
          $key = $(this.data.trackingKey);

      if ($type.val() === 'email') {
        $key.attr('placeholder', 'example@example.com');
      } else {
        $key.attr('placeholder', 'example');
      }
    },
    drag: {
      data: {
        $draggedEl: null
      },
      init: function(){
        var self = this,
            $planDetails = $('.plan-details');

        $planDetails.on('dragstart','.plan-notification[data-mode="edit"]', self.handleDragStart.bind(this));
        $planDetails.on('dragend','.plan-notification[data-mode="edit"]', self.handleDragEnd.bind(this));
        $planDetails.on('dragover','.plan-step[data-mode="edit"]', self.handleDragOver);
        $planDetails.on('dragenter','.plan-step[data-mode="edit"]', self.handleDragEnter);
        $planDetails.on('dragleave','.plan-step[data-mode="edit"]', self.handleDragLeave);
        $planDetails.on('drop', '.plan-step[data-mode="edit"]', self.handleDrop);
        $planDetails.on('dragstart', '.plan-step[data-mode="edit"]', self.handleStepStart.bind(this));

        //Allow text highlighting
        //Fix for HTML5 drag and drop - removes drag attribute on input focus and re-adds it on blur

        $planDetails.on('focus','.plan-notification[data-mode="edit"] input', function(){
          $(this).parents('.plan-notification, .plan-step').attr('draggable', false);
        });

        $planDetails.on('blur','.plan-notification[data-mode="edit"] input', function(){
          $(this).parents('.plan-notification, .plan-step').attr('draggable', true);
        });
      },
      handleStepStart: function(e){
        e = e.originalEvent;
        if (!$(e.target).hasClass('plan-notification')) {
          iris.typeahead.destroy();
          this.data.$draggedEl = $(e.target);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.dropEffect = "move";
          e.dataTransfer.setData('text/html', e.target.innerHTML);
        }
      },
      handleDragStart: function(e){
        e = e.originalEvent;
        e.stopPropagation();
        this.data.$draggedEl = $(e.target);
        iris.typeahead.destroy();
        $(e.target).addClass('dragging').parents('.plan-step').addClass('drag-source');
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData('text/html', e.target.outerHTML);
      },
      handleDragEnd: function(e){
        typeahead.init();
        $(e.target).removeClass('dragging');
        $('.drag-source').removeClass('drag-source');
      },
      handleDragOver: function(e){
        $(this).addClass('drag-over');
        e.preventDefault();
        return false;
      },
      handleDragEnter: function(e){
        e.preventDefault();
        $(this).addClass('drag-over');
      },
      handleDragLeave: function(e){
        e.preventDefault();
        $(this).removeClass('drag-over');
      },
      handleDrop: function(e){
          var parent = iris.plan,
            self = parent.drag,
            $this = $(this);
        e.preventDefault();
        e = e.originalEvent;

        if(!$this.hasClass('drag-source')) {

          //if dropped item is a step, switch steps, else move notification
          if(self.data.$draggedEl && self.data.$draggedEl.hasClass('plan-step')){
            var temp = $this.html();
            $this.html(e.dataTransfer.getData('text/html'));
            self.data.$draggedEl.html(temp);
            iris.typeahead.init();
          } else {
            $this.prepend(e.dataTransfer.getData('text/html'));
            self.data.$draggedEl.remove();
            iris.typeahead.init();
          }
        }
        $('.drag-over').removeClass('drag-over');
        $('.dragging').removeClass('dragging');
        $('.drag-source').removeClass('drag-source');
      }
    }
  }, //end iris.plan
  templates: {
    initialized: false,
    data: {
      url: '/api/v0/templates',
      $page: $('.main'),
      $table: $('#templates-table'),
      $filterForm: $('#filter-form'),
      tableTemplate: $('#templates-table-template').html(),
      DataTable: null,
      dataTableOpts: {
        orderClasses: false,
        order: [[2, 'desc']]
      }
    },
    init: function(){
      iris.changeTitle('Templates');
      var self = this;
      if (this.initialized == false) {
        this.initFilters();
        this.events();
        this.initialized = true;
      }
      iris.tables.filterTable.call(this);
    },
    events: function(){
      var data = this.data,
          $table = data.$table,
          $page = data.$page;

      $table.on('click', 'tbody tr[data-route]', function(e){
        if (e.target.tagName !== 'A') {
          if ((e.ctrlKey || e.metaKey)) {
            window.open($(this).attr('data-route'));
          } else {
            window.location = $(this).attr('data-route');
          }
        }
      });
      data.$filterForm.on('submit', iris.tables.filterTable.bind(this));
    },
    getData: function(params){
      var self = this;
      return $.getJSON(this.data.url, params).fail(function(){
        iris.createAlert('No templates found');
      });
    },
    initFilters: function(){
      iris.typeahead.init('user');
      $('.datetimepicker').datetimepicker({
        showClose: true
      });
    }
  }, //end iris.templates
  template: {
    data: {
      url: '/api/v0/templates/',
      name: '',
      id: null,
      path: null,
      $page: $('.main'),
      createTemplateBtn: '#publish-template',
      cloneTemplateBtn: '#clone-template',
      addStepBtn: '#add-step',
      removeStepBtn: '.remove-step',
      templateSteps: '.template-steps',
      appSelect: '.template-application',
      versionSelect: '.version-select',
      activateTemplate: '.badge[data-active="0"]',
      previewTemplate: '.preview-template',
      viewRelated: '.view-related',
      relatedPlans: [],
      stepTemplateSource: $('#template-step-template').html(),
      variablesTemplateSource: $('#variables-template').html(),
      templateSource: $('#template-template').html(),
      template: null,
      submitModel: {},
      modes: window.appData.modes,
      user: window.appData.user,
      blankModel: {
        applications: window.appData.applications,
        modes: window.appData.modes,
        content: {
          application: {
            email: {
              body: "",
              subject: ""
            },
            im: {
              body: "",
              subject: ""
            },
            sms: {
              body: "",
              subject: ""
            },
            call: {
              body: "",
              subject: ""
            }
          }
        },
        viewMode: false,
        creator: window.appData.user
      }
    },
    init: function(){
      var location = window.location.pathname.split('/'),
          path = this.data.path = location[location.length - 1],
          self = this;

      Handlebars.registerPartial('template-step', $('#template-step-template').html());
      Handlebars.registerPartial('template-notification', $('#template-notification-template').html());
      Handlebars.registerPartial('variables', this.data.variablesTemplateSource);
      this.getTemplate(path).done(function(response){
        self.events();
        iris.versionTour.init();
      });
    },
    events: function(){
      var data = this.data;
      $(data.createTemplateBtn).on('click', this.createTemplate.bind(this));
      data.$page.on('click', data.cloneTemplateBtn, this.cloneTemplate.bind(this));
      data.$page.on('click', data.addStepBtn, this.addStep.bind(this));
      data.$page.on('click', data.removeStepBtn, this.removeStep);
      data.$page.on('click', data.previewTemplate, this.previewTemplate);
      data.$page.on('click', data.activateTemplate, this.activateTemplate.bind(this));
      data.$page.on('click', data.viewRelated, this.viewRelated.bind(this));
      data.$page.on('change', data.appSelect, this.renderVariables.bind(this));
      data.$page.on('change', data.versionSelect, this.loadVersion.bind(this));
      window.onbeforeunload = iris.unloadDialog.bind(this);
    },
    addStep: function(){
      var template = Handlebars.compile(this.data.stepTemplateSource);
      $(this.data.addStepBtn).before(template(this.data.blankModel));
    },
    removeStep: function(){
      $(this).parents('.step').remove();
    },
    getTemplate: function(path){
      var self = this,
          template = this.data.template = Handlebars.compile(this.data.templateSource);

        //if path is new, render in edit mode.
        if (path === 'new') {
          var response = self.data.blankModel;
          response.viewMode = false;
          for (var i = 0, keys = Object.keys(response.content); i < keys.length; i++) {
            response.content[keys[i]].variables = self.getVariablesForApp(keys[i]);
          }
          self.data.$page.html(template(self.data.blankModel));
          iris.changeTitle('Edit Template');
          return $.Deferred().resolve();
        } else {
          self.data.viewMode = true;
          return $.getJSON(this.data.url + path).done(function(response){
            //shim response data for handlebars
            response.viewMode = true;
            response.applications = window.appData.applications;
            response.modes = window.appData.modes;
            for (var i = 0, keys = Object.keys(response.content); i < keys.length; i++) {
              response.content[keys[i]].application = keys[i];
              response.content[keys[i]].variables = self.getVariablesForApp(keys[i]);
            }
            self.data.ajaxResponse = response; //set response in root object for clone path functionality.
            self.data.id = response.id;
            self.data.name = response.name;
            self.data.relatedPlans = response.plans;
            self.data.$page.html(template(response));
            self.loadVersionSelect();
            iris.changeTitle('Template ' + self.data.name);
          }).fail(function(){
            iris.createAlert('"' + path +'" template not found. <a href="/templates/new">Create a new template.</a>');
          });
        }
    },
    getVariablesForApp: function(app){
      var apps = window.appData.applications;
      // get variables for apps in current template application
      for (var i = 0; i < apps.length; i++){
        if (apps[i].name === app) {
          var variables = {};
          for (var j = 0; j < apps[i].variables.length; j++){
            variables[apps[i].variables[j]] = {
              'required': apps[i].required_variables.indexOf(apps[i].variables[j]) > -1
            };
          }
          return variables;
        }
      }
    },
    renderVariables: function(e){
      var $el = $(e.target),
          app = $el.val(),
          self = this;

      self.data.$page.find(self.data.previewTemplate).css('display', !app ? 'none' : '');

      template = Handlebars.compile(self.data.variablesTemplateSource);
      $el.parents('.step').find('.variables').html(template({variables: this.getVariablesForApp(app)}));
    },
    cloneTemplate: function(){
      var response = this.data.ajaxResponse;
      response.viewMode = false;
      this.data.$page.html(this.data.template(response));
    },
    loadVersionSelect: function(){
      var $select = $(this.data.versionSelect),
          self = this,
          frag = '';

      $.ajax({
        url: this.data.url,
        data: {
          name:this.data.name,
          fields: ['id', 'created', 'creator']
        },
        traditional: true
      }).done(function(r){
        r = r.reverse();
        for (var i = 0; i < r.length; i++) {
          var entry = r[i];
          frag += [
            '<option ', ((entry.id === self.data.id) ? 'selected' : ''),
            ' value="', entry.id,
            '" data-id="', entry.id + '">',
            'ID ', entry.id, ' - ',
            moment.unix(entry.created).local().format('YYYY/MM/DD HH:mm:ss [GMT]ZZ'),
            ' by ', entry.creator,
            ' </option>'
          ].join('');
        }
        $select.append(frag);
      });
    },
    loadVersion: function(e){
      var versionId = $(e.target).find('option:selected').attr('data-id');
      this.getTemplate(versionId);
      window.history.pushState(null, null, versionId); //update url bar for refreshes
    },
    activateTemplate: function(e){
      var $el = $(e.target);

      $.ajax({
          url: this.data.url + this.data.id,
          data: JSON.stringify({active: 1}),
          method: 'POST',
          contentType: 'application/json'
      }).done(function(r){
        $el.attr('data-active', 1);
      }).fail(function(){
        iris.createAlert('Failed to activate.');
      });
    },
    viewRelated: function(e){
      var $modal = $($(e.target).attr('data-target')),
          frag = '',
          data = this.data.relatedPlans;
      if (data.length) {
        for (var i = 0; i < data.length; i++) {
          frag += '<li class="border-bottom"><a href="/plans/' + data[i]["id"] + '">' + data[i]["name"] + ' - ID ' + data[i]['id']+ '</a></li>';
        }
        $modal.find('.modal-body .modal-list').html(frag);
      } else {
        $modal.find('.modal-body .modal-list').text('No plans are currently using this template.');
      }
    },
    updateSubmitModel: function(){
      // gets & checks data from plan inputs and prepares model for post.
      var model = this.data.submitModel,
          $steps = $(this.data.templateSteps),
          self = this;

      model.creator = this.data.user;
      model.name = $('#template-name').val();
      model.content = {};
      $steps.find('.step').each(function(){
        var $this = $(this),
            application = $this.find('.template-application').val();

        model.content[application] = {};

        $this.find('.template-notification').each(function(){
          var mode = $(this).attr('data-mode');

          if (mode === 'email') {
            model.content[application][mode] = {
              subject: $(this).find('.template-subject').val(),
              body: $(this).find('.template-body').val()
            }
          } else {
            model.content[application][mode] = {
              subject: '',
              body: $(this).find('.template-body').val()
            }
          }
        });
      });

      // reset invalid inputs from previous check
      this.data.$page.find('.invalid-input').removeClass('invalid-input');
      if (
        $('.view-template select, .view-template input, .view-template textarea')
        .filter(function(){
          return !$(this).val();
        })
        .addClass('invalid-input')
        .length > 0
      ){
        model.isValid = false;
        iris.createAlert('Missing fields', 'danger', this.data.$page);
      } else if($steps.find('.step').length > 1){
        var apps = [];
        model.isValid = true;
        $steps.find('.template-application').each(function(){
          var val = $(this).val();
          if (apps.indexOf(val) !== -1) {
            $(this).addClass('invalid-input');
            model.isValid = false;
            iris.createAlert('Please pick a unique application for each template.', 'danger', self.data.$page);
          } else {
            apps.push(val);
          }
        });
      } else {
        model.isValid = true;
      }
    },
    previewTemplate: function(){
      var $this = $(this),
          mode = $this.attr('data-mode'),
          $notification = $this.parents('.template-notification'),
          $step = $this.parents('.step'),
          submitModel = {},
          $modal = $('#preview-template-modal'),
          $modalBody = $modal.find('.modal-body');

      submitModel.application = $step.find('.template-application').val();
      if (!submitModel.application) {
          iris.createAlert('Please select an application.', 'danger', $modalBody);
          return;
      }
      submitModel.templateSubject = $notification.find('.template-subject').val() || ' ';
      submitModel.templateBody = $notification.find('.template-body').val();

      $modalBody.html('<i class="loader"></i>');
      $.ajax({
        type: 'post',
        url: '/validate/jinja',
        dataType: 'json',
        data: submitModel
      }).done(function(r){
        if (r.template_subject || r.template_body) {
          $modalBody.html( ( (mode === 'email') ? '<div class="preview-subject">' + Handlebars.helpers.breakLines(r.template_subject) + '</div>' : '') + '<div class="preview-body">' + Handlebars.helpers.breakLines(r.template_body) + '</div>');
        } else {
          $modalBody.empty();
          iris.createAlert('Invalid template', 'danger', $modalBody);
        }
      }).fail(function(r){
        $modalBody.empty();
        if (r.responseJSON && r.responseJSON.lineno && r.responseJSON.error) {
          iris.createAlert('Line: ' + r.responseJSON.lineno + '<br />Error: ' + r.responseJSON.error, 'danger', $modalBody);
        } else if (r.responseJSON && r.responseJSON.error) {
          iris.createAlert('Error: ' + r.responseJSON.error, 'danger', $modalBody);
        } else {
          iris.createAlert('Invalid template', 'danger', $modalBody);
        }
      });
    },
    createTemplate: function(e){
      var model = this.data.submitModel,
          self = this,
          $button = $(e.target);

      this.updateSubmitModel();

      if (model && model.isValid) {
        $button.addClass('disabled');
        $.ajax({
          url: self.data.url,
          data: JSON.stringify(model),
          method: 'POST',
          contentType: 'application/json'
        }).done(function(response){
          if (response) {
            window.onbeforeunload = null; //detach confirm dialog if plan is published.
            window.location = response;
          }
        }).fail(function(response){
          var errorTxt = (response && response.responseJSON && response.responseJSON.error) ? response.responseJSON.error : 'Template creation failed.';
          $button.removeClass('disabled');
          iris.createAlert('Error: ' + errorTxt);
        });
      }
    },
  }, //end iris.template
  incidents: {
    initialized: false,
    data: {
      url: '/api/v0/incidents/',
      fields: ['id', 'owner', 'application', 'plan', 'plan_id', 'created', 'updated', 'active', 'current_step'],
      $page: $('.main'),
      $table: $('#incidents-table'),
      $filterApp: $('#filter-application'),
      $filterForm: $('#filter-form'),
      tableTemplate: $('#incidents-table-template').html(),
      summaryCtxHash: {},
      DataTable: null,
      dataTableOpts: {
        orderClasses: false,
        order: [[0, 'desc']],
        oLanguage: {
          sEmptyTable: "Use the filters above to find incidents",
          sZeroRecords: "Use the filters above to find incidents"
        },
        columns: [
          null,
          null,
          { width: '25%', orderable: false },
          null,
          { width: '10%' },
          { width: '10%' },
          null,
          null
        ]
      }
    },
    init: function(){
      iris.changeTitle('Incidents');
      var self = this;
      if (this.initialized == false) {
        this.initFilters();
        this.events();
        this.initialized = true;
      }
      this.data.dataTableOpts.fnInitComplete = this.tableDrawComplete.bind(self);
      iris.tables.filterTable.call(this);
      this.data.$table.on('draw.dt', self.getSummary.bind(self));
    },
    tableDrawComplete: function() {
      var self = this,
          $empty = $('.dataTables_empty');
      if ($empty && $('#filter-active').prop('checked')) {
        $empty.append($('<br>'))
              .append($('<a>Try viewing all incidents instead of just active incidents</a>')
                        .click(function() {
                           $('#filter-all').prop('checked', 'true');
                           self.data.$filterForm.submit();
                        }));
      }
    },
    events: function(){
      var data = this.data,
          $table = data.$table,
          $page = data.$page,
          self = this;

      $table.on('click', 'tbody tr[data-route]', function(e){
        if (e.target.tagName !== 'A') {
          if ((e.ctrlKey || e.metaKey)) {
            window.open($(this).attr('data-route'));
          } else {
            window.location = $(this).attr('data-route');
          }
        }
      });

      $table.on('click', '.claim-incident', function(e){
        e.stopPropagation();
        self.claimIncident(e);
      });

      data.$filterForm.on('submit', iris.tables.filterTable.bind(this));
    },
    getData: function(params){
       var self = this,
           fields = this.data.fields;

      //merge params and fields
      params['fields'] = fields;
      params['limit'] = iris.data.tableEntryLimit;

      return $.ajax({
        url: this.data.url,
        data: params,
        traditional: true
      }).fail(function(){
        iris.createAlert('No incidents found');
      });
    },
    getSummary: function(){
      var self = this,
          params = {
            'fields': ['id', 'context', 'application'],
            'id__in': null
          },
          templateSource = $('#summary-template').html(),
          getCtxRequest = new $.Deferred(),
          idList = [],
          $summaryTh = this.data.$table.find('td.summary');

      this.data.$table.find('tbody tr').each(function(){
        var id = $(this).data('route');
        if (id) {
          idList.push(id);
        }
      });

      if (idList.length) {
        var filteredIdList = idList.filter(function(i){ return self.data.summaryCtxHash[i] === undefined});

        if (filteredIdList.length) {
          params.id__in = filteredIdList.toString();
          $summaryTh.attr('data-loading', true);
          getCtxRequest = $.ajax({
            url: self.data.url,
            data: params,
            traditional: true
          }).done(function(data){
            for (var i = 0; i < data.length; i++) {
              var item = data[i];
              self.data.summaryCtxHash[item.id] = item;
            }
          });
        } else {
          getCtxRequest.resolve(); // resolve promise if all data exists in hash
        }

        getCtxRequest.done(function(){
          $summaryTh.attr('data-loading', '');
          for (var i = 0; i < idList.length; i++) {
            var item = self.data.summaryCtxHash[idList[i]],
                app = window.appData.applications.filter(function(l){ return l.name === item.application })[0],
                currTmplSrc,
                template;

            currTmplSrc = app && app.summary_template || templateSource;
            template = Handlebars.compile(currTmplSrc);
            self.data.$table.find('tr[data-route=' + item.id + '] .incident-summary').html(template(item));
          }
        });
      }

    },
    initFilters: function(){
      for (var i = 0; i < window.appData.applications.length; i++) {
        this.data.$filterApp.append($(document.createElement('option')).attr({ value: window.appData.applications[i].name }).text(window.appData.applications[i].name));
      }
      iris.typeahead.init('user');
      $('.datetimepicker').datetimepicker({
        showClose: true
      });
    },
    claimIncident: function(e){
      var $this = $(e.target),
          owner = $this.attr('data-action') === 'claim' ? window.appData.user : null,
          self = this,
          incidentId = $this.attr('data-id');
      $this.addClass('disabled');
      $.ajax({
        url: self.data.url + incidentId,
        data: JSON.stringify({
          owner: owner
        }),
        method: 'POST',
        contentType: 'application/json'
      }).done(function(data){
        var active = data.active;
        incidentId = data.incident_id;
        var message = active ? 'Incident ' + incidentId + ' unclaimed.' : 'Incident ' + incidentId + ' claimed.';
        iris.createAlert(message, 'success', null, null, 'fixed');
        $this.attr('data-action', active ? 'claim' : 'unclaim')
          .text(active ? 'Claim Incident' : 'Unclaim Incident')
          .parents('tr[data-route=' + incidentId + ']').find('.owner').text(active ? 'Unclaimed' : owner);
      }).fail(function(){
        iris.createAlert('Failed to modify incident', 'danger');
      }).always(function(){
        $this.removeClass('disabled');
      });
    }
  },
  incident: {
    data: {
      url: '/api/v0/incidents/',
      $page: $('.main'),
      id: null,
      claimIncidentBtn: '#claim-incident',
      incidentSource: $('#incident-template').html(),
      messageTable: '#incident-messages-table',
      DataTable: null,
      dataTableOpts: {
        orderClasses: false,
        order: [[0, 'desc']],
        oLanguage: {
          sEmptyTable: "No messages have been sent for this incident.",
          sZeroRecords: "No messages have been sent for this incident."
        }
      }
    },
    init: function(){
      var self = this,
          location = window.location.pathname.split('/'),
          path = this.data.id = location[location.length - 1];

      this.getIncident(this.data.id);
    },
    events: function(){
      var data = this.data;
      data.$page.on('click', data.claimIncidentBtn, this.claimIncident.bind(this));
    },
    getIncident: function(path){
      var self = this;

      return $.getJSON(self.data.url + path).done(function(response){
        iris.changeTitle('Incident #' + response.id);
        $.getJSON('/api/v0/applications/' + response.application).done(function(application){
          if (application.context_template) {
            Handlebars.registerPartial('context_template', application.context_template);
          }
          var template = self.data.template = Handlebars.compile(self.data.incidentSource);
          response.user = window.appData.user;
          self.data.$page.html(template(response));
          self.data.DataTable = $(self.data.messageTable).DataTable(self.data.dataTableOpts);
          iris.tables.bindArrowKeys(self.data.DataTable);
          self.events();
        });
      }).fail(function(){
        iris.createAlert('Incident not found');
      });
    },
    claimIncident: function(e){
      var $this = $(e.target),
          owner = $this.attr('data-action') === 'claim' ? window.appData.user : null,
          self = this,
          incidentId = $this.attr('data-id');
      $this.addClass('disabled');
      $.ajax({
        url: self.data.url + incidentId,
        data: JSON.stringify({
          owner: owner
        }),
        method: 'POST',
        contentType: 'application/json'
      }).done(function(){
        self.getIncident(incidentId).done(function(){
          var message = owner ? 'Incident ' + incidentId + ' claimed.' : 'Incident ' + incidentId + ' unclaimed.';
          iris.createAlert(message, 'success');
        });
      }).fail(function(){
        iris.createAlert('Failed to modify incident', 'danger');
      }).always(function(){
        $this.removeClass('disabled');
      });
    }
  },
  messages: {
    initialized: false,
    data: {
      url: '/api/v0/messages',
      fields: ['id', 'batch', 'target', 'subject', 'incident_id', 'priority', 'application', 'mode', 'sent', 'mode_changed', 'target_changed'],
      $page: $('.main'),
      $table: $('#messages-table'),
      $filterApp: $('#filter-application'),
      $filterPriority: $('#filter-priority'),
      $filterForm: $('#filter-form'),
      tableTemplate: $('#messages-table-template').html(),
      DataTable: null,
      dataTableOpts: {
        orderClasses: false,
        order: [[0, 'desc']],
        oLanguage: {
          sEmptyTable: "Use the filters above to find messages",
          sZeroRecords: "Use the filters above to find messages"
        },
        columns: [
          null,
          null,
          null,
          { width: '30%' },
          null,
          null,
          null,
          null,
          null
        ]
      }
    },
    init: function(){
      iris.changeTitle('Messages');
      var self = this;
      if (this.initialized == false) {
        this.initFilters();
        this.events();
        this.initialized = true;
      }
      iris.tables.filterTable.call(this);
    },

    events: function(){
      var data = this.data,
          $table = data.$table,
          $page = data.$page;

      $table.on('click', 'tbody tr[data-route]', function(e){
        if (e.target.tagName !== 'A') {
          if ((e.ctrlKey || e.metaKey)) {
            window.open($(this).attr('data-route'));
          } else {
            window.location = $(this).attr('data-route');
          }
        }
      });
      data.$filterForm.on('submit', iris.tables.filterTable.bind(this));
    },
    getData: function(params){
      var self = this,
          fields = this.data.fields;

      //merge params and fields
      params['fields'] = fields;
      params['limit'] = iris.data.tableEntryLimit;

      return $.ajax({
        url: this.data.url,
        data: params,
        traditional: true
      }).fail(function(){
        iris.createAlert('No messages found');
      });
    },
    initFilters: function(){
      for (var i = 0; i < window.appData.applications.length; i++) {
        this.data.$filterApp.append($(document.createElement('option')).attr({ value: window.appData.applications[i].name }).text(window.appData.applications[i].name));
      }
      for (var i = 0; i < window.appData.priorities.length; i++) {
        this.data.$filterPriority.append($(document.createElement('option')).attr({ value: window.appData.priorities[i].name }).text(window.appData.priorities[i].name));
      }
      iris.typeahead.init('user');
      $('.datetimepicker').datetimepicker({
        showClose: true
      });
      // $('#filter-start').data('DateTimePicker').date(moment().subtract(1, 'hours'));
    }
  },
  message: {
    data: {
      url: '/api/v0/messages/',
      $page: $('.main'),
      incidentSource: $('#message-template').html()
    },
    init: function(){
      var self = this,
          location = window.location.pathname.split('/'),
          path = this.data.id = location[location.length - 1];
      this.getMessage(path);
    },
    getMessage: function(path){
      var self = this,
          template = this.data.template = Handlebars.compile(this.data.incidentSource),
          template_vars = {changes: []};
      $.getJSON(self.data.url + path).done(function(data) {
          $.extend(template_vars, data);
          $.getJSON(self.data.url + path + '/auditlog').done(function(data) {
            data.forEach(function(change) {
              var old_halves = change.old.split('|');
              if (old_halves.length == 2) {
                change.old = old_halves[1];
                change.old_role = old_halves[0];
              }
              change.change_type = change.change_type.split('-')[0];
            });
            template_vars.changes = data;
          }).always(function() {
            self.data.$page.html(template(template_vars));
            iris.changeTitle('Message #' + template_vars.id);
          });
      }).fail(function() {
          iris.createAlert('Message not found');
          return;
      });
    },
  },
  user: {
    data: {
      url: '/api/v0/users/',
      postModesUrl: '/api/v0/users/modes/',
      reprioritizationUrl: '/api/v0/users/reprioritization/',
      user: window.appData.user,
      settings: null,
      reprioritizationSettings: [],
      $page: $('.main'),
      $priority: $('#priority-table'),
      $batching: $('#batching-table'),
      $contact: $('.user-contact-module'),
      $saveBtn: $('#save-settings'),
      $reprioritizationToggleBtn: $('#reprioritization h4'),
      $reprioritizationAddBtn: $('#reprio-add-btn'),
      $reprioritizationTable: $('#reprioritization-table'),
      $addAppSelect: $('#add-application-select'),
      $addAppBtn: $('#add-application-button'),
      appsToDelete: {},
      priorityTemplate: $('#priority-template').html(),
      batchingTemplate: $('#batching-template').html(),
      subheaderTemplate: $('#user-contact-template').html(),
      reprioritizationTemplate: $('#reprioritization-table-template').html(),
      postModel: {}
    },
    init: function(){
      iris.changeTitle('Settings');
      var self = this;
      this.getUserSettings().done(function(){
        self.createContactModule();
        self.createPriorityTable();
        self.events();
      });
      this.getReprioritizationSettings().done(function(){
        self.populateReprioritization();
      });
    },
    events: function(){
      var self = this;
      this.data.$saveBtn.on('click', function(){
        self.saveSetting();
      });
      this.data.$reprioritizationAddBtn.on('click', function(){
        $(this).addClass('disabled');
        self.saveReprioritizationSettings();
      });
      this.data.$reprioritizationToggleBtn.on('click', function(){
        self.toggleReprioritization();
      });
      this.data.$addAppBtn.on('click', function(){
        self.addApplication();
      });
      this.data.$addAppSelect.change(function() {
        self.data.$addAppBtn.prop('disabled', $(this).val() == '');
      });
      self.data.$saveBtn.prop('disabled', true);
      self.data.$addAppBtn.prop('disabled', true);
    },
    getUserSettings: function(){
      var self = this;
      return $.getJSON(this.data.url + this.data.user).done(function(response){
        self.data.settings = response;
        //add app data to settings.
        self.data.settings.priorities = window.appData.priorities;
        self.data.settings.modeSet = window.appData.modes;
        self.data.settings.applications = window.appData.applications;
      }).fail(function(response){
        iris.createAlert('Error: Failed to load data -' + response.text);
      });
    },
    toggleReprioritization: function() {
      $('#reprioritization').toggleClass('active')
    },
    getReprioritizationSettings: function() {
      var self = this;
      return $.getJSON(this.data.reprioritizationUrl + this.data.user).done(function(response){
        self.data.reprioritizationSettings = response;
      }).fail(function(response){
        iris.createAlert('Error: Failed to load reprioritization data -' + response.text);
      });
    },
    saveReprioritizationSettings: function() {
      var data = {},
          self = this;
      $('#reprioritization input, #reprioritization select').each(function() {
        data[$(this).data('type')] = $(this).val();
      });
      data['duration'] *= 60;
      $.ajax({
        url: this.data.reprioritizationUrl + this.data.user,
        data: JSON.stringify(data),
        method: 'POST',
        contentType: 'application/json'
      }).done(function(){
        iris.createAlert('Reprioritization added.', 'success');
        self.getReprioritizationSettings().done(function(){
          self.populateReprioritization();
        });
      }).fail(function(response){
        iris.createAlert('Failed to add reprioritization: ' + response.responseJSON.description, 'danger');
      }).always(function(){
        self.data.$reprioritizationAddBtn.removeClass('disabled');
      });
    },
    deleteReprioritizationSetting: function(src_mode) {
      var self = this;
      $.ajax({
        url: this.data.reprioritizationUrl + this.data.user + '/' + src_mode,
        method: 'DELETE',
        contentType: 'application/json',
        data: '{}'
      }).done(function(){
        iris.createAlert('Reprioritization rule deleted.', 'success');
        self.getReprioritizationSettings().done(function(){
          self.populateReprioritization();
        });
      }).fail(function(){
        iris.createAlert('Failed deleting', 'danger');
      });
    },
    populateReprioritization: function() {
      $('#reprioritization select').each(function(){
        var frag = '';
        window.appData.modes.forEach(function(mode) {
          frag += ['<option>', mode, '</option>'].join('');
        })
        $(this).html(frag)
      });
      $('#reprio-dest-mode').val('sms');

      if (!this.data.reprioritizationSettings.length) {
        this.data.$reprioritizationTable.hide();
        return;
      }

      var existingReprioTemplate = Handlebars.compile(this.data.reprioritizationTemplate);
      this.data.$reprioritizationTable.html(existingReprioTemplate(this.data.reprioritizationSettings));
      this.data.$reprioritizationTable.show();

      var self = this;

      $('#reprioritization-table button').click(function(){
        self.deleteReprioritizationSetting($(this).data('src-mode'));
      });
    },
    createContactModule: function(){
      var template = Handlebars.compile(this.data.subheaderTemplate),
          settings = this.data.settings;
      this.data.$contact.html(template(settings));
    },
    createPriorityTable: function(){
      var template = Handlebars.compile(this.data.priorityTemplate),
          $priority = this.data.$priority,
          settings = this.data.settings,
          self = this;
      var global_default_values = {};
      var app_default_values = {};
      var app_supported_modes = {};
      settings.per_app_defaults = {};
      window.appData.priorities.forEach(function(priority) {
        global_default_values[priority.name] = priority.default_mode;
      });
      window.appData.applications.forEach(function(app) {
        app_default_values[app.name] = app.default_modes;
        app_supported_modes[app.name] = app.supported_modes;
      });
      settings.per_app_defaults_obj = {};
      for (var app in settings.per_app_modes) {
        settings.per_app_defaults[app] = {priorities: [], supported_modes: app_supported_modes[app]};     // Needed for handlebars
        settings.per_app_defaults_obj[app] = {}; // Needed for JS elsewhere
        window.appData.priorities.forEach(function(p) {
          var priority = p.name;
          var default_mode = app_default_values[app][priority] ? app_default_values[app][priority] : (
            global_default_values[priority] ? global_default_values[priority] : ''
          );
          settings.per_app_defaults[app].priorities.push({
            priority_name: priority,
            default_mode: default_mode
          });
          settings.per_app_defaults_obj[app][priority] = default_mode;
        });
      }
      this.data.$priority.empty();
      this.data.$priority.append(template(settings));
      //load saved user settings to ui, and make changing any of them enable the save button
      $priority.find('select').each(function(){
        var priority = $(this).data('type'),
            app = $(this).data('app'),
            setting;
        if (app) {
          setting = settings.per_app_modes[app][priority] ? settings.per_app_modes[app][priority] : 'default';
        } else {
          setting = settings.modes[priority] ? settings.modes[priority] : 'default';
        }
        $(this).val(setting);
        // On dropdown change state, modify our settings dictionaries so the next table redraw shows
        // the changed settings
        $(this).change(function() {
          self.data.$saveBtn.prop('disabled', false);
          var val = $(this).val();
          if (app) {
            settings.per_app_modes[app][priority] = val;
          }
          else {
            // Our per-app dropdowns do not have default, so don't bother
            if (val == 'default') {
              delete settings.modes[priority];
            } else {
              settings.modes[priority] = val;
            }
          }
        });
      });
      $priority.find('button.delete-app-button').each(function() {
        $(this).click(function() {
          self.deletePerApp($(this));
        });
      });
      this.redrawApplicationDropdown();
    },
    createBatchingTable: function(){
      var template = Handlebars.compile(this.data.batchingTemplate),
          $priority = this.data.$priority,
          settings = this.data.settings;
      this.data.$batching.append(template(settings));
    },
    deletePerApp: function(elem) {
      var self = this,
          app = elem.data('app');
      self.data.$saveBtn.prop('disabled', false);
      delete self.data.settings.per_app_modes[app];
      self.data.appsToDelete[app] = true;
      self.createPriorityTable();
    },
    saveSetting: function(){
      var globalOptions = this.data.postModel,
          self = this;
      self.data.$saveBtn.prop('disabled', true);
      //get form data
      $('#priority-table select.global-priority').each(function(){
        var $this = $(this);
        globalOptions[$this.attr('data-type')] = $this.val();
      });

      globalOptions.per_app_modes = {};

      $('#priority-table tr.app-row').each(function() {
        var app = $(this).data('app'), all_default = true;

        globalOptions.per_app_modes[app] = {};

        $(this).find('select.app-priority').each(function() {
            var $this = $(this), val = $this.val();
            globalOptions.per_app_modes[app][$this.attr('data-type')] = val;
            if (val != 'default') {
              all_default = false;
            }
        });

        // If the user chooses 'default' for all values, set each one to the default value for that app or column to avoid the row
        // disappearing on reload (as all 'default' deletes the custom setting)
        if (all_default) {
          for (var key in globalOptions.per_app_modes[app]) {
            globalOptions.per_app_modes[app][key] = self.data.settings.per_app_defaults_obj[app][key];
          }
        }
      });

      for (var app in self.data.appsToDelete) {
        globalOptions.per_app_modes[app] = {};
        self.data.settings.priorities.forEach(function(p) {
          globalOptions.per_app_modes[app][p.name] = 'default';
        });
      }

      self.data.appsToDelete = {};

      $.ajax({
        url: this.data.postModesUrl + this.data.user,
        data: JSON.stringify(globalOptions),
        method: 'POST',
        contentType: 'application/json'
      }).done(function(){
        iris.createAlert('Settings saved.', 'success');
      }).fail(function(){
        iris.createAlert('Failed to save settings', 'danger');
      });
    },
    redrawApplicationDropdown: function() {
      var self = this;
      self.data.$addAppSelect.empty();
      self.data.$addAppSelect.append($('<option value="">').text('Add Application'));
      var myApps = Object.keys(self.data.settings.per_app_modes);
      this.data.settings.applications.forEach(function(app) {
        if (myApps.indexOf(app.name) == -1) {
          self.data.$addAppSelect.append($('<option>').text(app.name));
        }
      });
    },
    addApplication: function() {
      var app = this.data.$addAppSelect.val();
      this.data.$addAppSelect.val('');
      this.data.$addAppBtn.prop('disabled', true);
      if (app == '') {
        return;
      }
      this.data.$saveBtn.prop('disabled', false);
      this.data.settings.per_app_modes[app] = {};
      if (app in this.data.appsToDelete) {
        delete this.data.appsToDelete[app];
      }
      this.createPriorityTable();
    }
  }, //end iris.user
  applications: {
    data: {
      $page: $('.main'),
      $table: $('#applications-table'),
      tableTemplate: $('#applications-table-template').html(),
      DataTable: null,
      dataTableOpts: {
        orderClasses: false,
        order: [[0, 'asc']]
      }
    },
    init: function() {
      iris.changeTitle('Applications');
      iris.tables.createTable.call(this, window.appData.applications);
      this.events();
    },
    events: function() {
      this.data.$table.find('tbody tr').click(function() {
        window.location = '/applications/' + $(this).data('application');
      })
    }
  }, // End iris.applications
  application: {
    data: {
      url: '/api/v0/applications/',
      $page: $('.main'),
      $editButton: $('#application-edit-button'),
      applicationTemplate: $('#application-template').html(),
      application: null,
      model: {}
    },
    init: function() {
      var location = window.location.pathname.split('/'),
          application = decodeURIComponent(location[location.length - 1]);
      this.data.application = application;
      this.getApplication(application);
    },
    events: function() {
      var self = this;
      $('#application-edit-button').click(function() {
        self.editApplication();
      });
      $('#application-save-button').click(function() {
        self.saveApplication();
      });
      $('.remove-variable').click(function() {
        var variable = $(this).data('variable');
        var pos = self.data.model.variables.indexOf(variable);
        if (pos > -1) {
            self.data.model.variables.splice(pos, 1)
        }
        $(this).parent().remove();
      });
      $('#add-variable-form').submit(function() {
        var variable = $('#add-variable-box').val();
        if (variable == '') {
            iris.createAlert('Cannot add empty variable');
            return false;
        }
        if (self.data.model.variables.indexOf(variable) > -1) {
            iris.createAlert('That variable "'+variable+'" already exists');
            return false;
        }
        $('#add-variable-box').val('');
        self.data.model.variables.push(variable);
        self.render();
        return false;
      });
      window.onbeforeunload = iris.unloadDialog.bind(this);
    },
    getApplication: function(application) {
      var app = null, self = this;
      for (var i = 0, item; i < window.appData.applications.length; i++) {
          item = window.appData.applications[i];
          if (item.name == application) {
              app = item;
              break;
          }
      }
      if (!app) {
        iris.createAlert('Application not found');
        return;
      }
      iris.changeTitle('Application ' + app.name);
      $.getJSON(this.data.url + application + '/quota').done(function(response) {
        app.quota = response;
      }).fail(function() {
        // When quota does not exist, that endpoint 404s even though application is real
        app.quota = null;
      }).always(function() {
        app.viewMode = true;
        app.editable = app.owners.indexOf(window.appData.user) > -1;
        self.data.model = app;
        self.render();
      });
    },
    editApplication: function() {
      this.data.model.viewMode = false;
      this.render();
    },
    saveApplication: function() {
      var self = this;
      $('.application-settings').find('textarea').each(function(k, elem) {
        var $elem = $(elem);
        self.data.model[$elem.data('field')] = $elem.val();
      });
      if (self.data.model.sample_context == '') {
        self.data.model.sample_context = '{}';
      }
      $.ajax({
        url: self.data.url + self.data.application,
        data: JSON.stringify(self.data.model),
        method: 'PUT',
        contentType: 'application/json'
      }).done(function(data){
        self.data.model.viewMode = true;
        self.render();
        iris.createAlert('Settings saved', 'success');
      }).fail(function(data) {
        iris.createAlert('Settings failed to save: '+data.responseJSON.title);
      });
    },
    render: function() {
      var template = Handlebars.compile(this.data.applicationTemplate);
      this.data.$page.html(template(this.data.model));
      this.events();
    }
  }, // End iris.application
  stats: {
    data: {
      url: '/api/v0/stats',
      $page: $('.stats'),
      $table: $('#stats-table'),
      tableTemplate: $('#stats-table-template').html(),
      DataTable: null,
      dataTableOpts: {
        orderClasses: false,
        order: [[0, 'asc']],
        columns: [
          null,
          null
        ]
      }
    },
    init: function() {
      iris.changeTitle('Stats');
      iris.tables.filterTable.call(this);
    },
    events: function() {},
    getData: function(params) {
      return $.getJSON(this.data.url, params).fail(function(){
        iris.createAlert('No stats found');
      });
    }
  }, // End iris.stats
  tables: {
    filterTable: function(e){
      if (e) {
        // form submitted - serialize and shove into qs
        var $form = $(e.target);
        var $btn;
        $btn = $form.find('button[type="submit"]');
        $btn.prop('disabled', true);
        e.preventDefault();

        var url = window.location.protocol + "//" + window.location.host + window.location.pathname + '?';
        var qs_form = $form.serializeArray();
        for (var i = 0; i < qs_form.length; i++) {
          var k = qs_form[i].name;
          var v = qs_form[i].value;
          if (v) {
            url += k.slice(7) +'=' + encodeURI(v) + '&';
          }
        }
        url = url.slice(0, -1)
        history.pushState(url, null, url);
      };
      var self = this;

      if (window.location.search) {
        var qs = {};
        var qs_parts = decodeURI(window.location.search.substr(1)).split('&');
        for (var i = qs_parts.length - 1; i >= 0; i--) {
          qs_pair = qs_parts[i].split('=');
          qs[qs_pair[0]] = qs_pair[1];
        }
      } else {
        qs = {
          'active': 'active',
          'target': appData.user
        };
      }
      var params = {};

      // add loading icon
      this.data.$table.html('<tr><td><i class="loader"></i></td></tr>');
      $('#filter-form input, #filter-form select').each(function(){

        var $this = $(this);
        var name = $this.attr('name');
        var value = $this.val();
        if (typeof(name) != 'undefined') {
          var qs_name = name.split('-')[1];
          var qs_value = qs[qs_name];
        }

        switch (name) {
          case 'filter-active':
            var v = $this.prop('id').slice(7);
            if ((v == qs_value) || (v=='all' && qs_value === undefined)) {
              $this.prop('checked', true);
            } else {
              $this.prop('checked', false);
            }
            break;
          case 'filter-start':
          case 'filter-end':
            $this.val(qs_value);
            if ($this.val().length) {
              params[$this.attr('data-param')] = moment(qs_value).unix();
            }
            break;
          default:
            $this.val(qs_value);
            params[$this.attr('data-param')] = qs_value;
            break;
        }

      });

      switch (qs['active']) {
        case 'active':
          params['active'] = 1;
          break;
        case 'inactive':
          params['active'] = 0;
          break;
      }

      self.getData(params).done(function(data){
        if (self.data.DataTable) {
          self.data.DataTable.destroy();
        }
        self.data.$table.empty();
        iris.tables.createTable.call(self, data);
      }).always(function(){
        if ($btn && $btn.prop('disabled')) { $btn.prop('disabled', false) };
      });
    },
    createTable: function(data){
      var template = Handlebars.compile(this.data.tableTemplate),
          options = this.data.dataTableOpts || { orderClasses: false };
      if (data.length == iris.data.tableEntryLimit){
        data.limit = iris.data.tableEntryLimit;
      }
      this.data.$table.html(template(data));
      this.data.DataTable = this.data.$table.DataTable(options);
      iris.tables.bindArrowKeys(this.data.DataTable);
    },
    bindArrowKeys: function(dataTable) {
      $(document).keydown(function(e) {
        if (e.keyCode == 37) {
          dataTable.page('previous').draw(false);
        } else if (e.keyCode == 39) {
          dataTable.page('next').draw(false);
        }
      });
    }
  },
  createAlert: function(alertText, type, $el, action, fixed){
    //params:
    //-- alertText: content of alert *REQUIRED* --string--
    //-- type: type of alert (coincides to color) --string--
      //---- 'danger' - red *default*
      //---- 'warning' - yellow
      //---- 'info' - blue
      //---- 'success' - green
    //-- $el: DOM element which the alert will be added to. Defaults to body --jQuery element--
    //-- action: jQuery action on the $el.
      //---- 'prepend' - inserts alert as first element inside $el *default*
      //---- 'append' - inserts alert at the end of the $el
      //---- 'before' - inserts alert as a sibling node before $el
      //---- 'after' - inserts alert as a sibling node after $el
    //-- fixed: alternate alert which is absolutely positioned at top center of the screen
    var alert,
        type = type || 'danger',
        $el = $el || $('.main'),
        action = action || 'prepend';
    if (!$('#iris-alert').length) {
      alert = '<div id="iris-alert" class="alert alert-'+ type +' alert-dismissible ' + fixed + '" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button><span class="alert-content"></span></div>';
      $el[action](alert);
    }
    $('#iris-alert .alert-content').html(alertText);
  }, //end createAlert
  typeahead: {
    data: {
      url: '/api/v0/targets/',
      field: 'input.typeahead',
    },
    init: function(urlType){
      var $field = $(this.data.field),
          self = this;
      $field.typeahead('destroy').each(function(){
        var $this = $(this),
            type = urlType || $this.parents('.plan-notification').find('select[data-type="role"] option:selected').attr('data-url-type'), //get url type from sibling "Role" option
            results = new Bloodhound({
              datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
              queryTokenizer: Bloodhound.tokenizers.whitespace,
              remote: {
                url: self.data.url + type + '?startswith=%QUERY',
                wildcard: '%QUERY'
              }
            });
        $this.typeahead(null, {
          hint: true,
          async: true,
          highlight: true,
          source: results
        }).on('typeahead:select', function(){
          $(this).attr('value', $(this).val());
        });
      });
    },
    destroy: function() {
      $(this.data.field).typeahead('destroy');
    }
  },
  unloadDialog: function(){
    if ( this.data.$page.find('input, textarea').not('[data-default]').filter(function () { return !!this.value }).length > 0 ) {
      return 'You have unsaved changes';
    }
  },
  versionTour: {
    type: 'templates',
    init: function(type){
      var self = this;
      this.type = type;
      if (!localStorage.getItem('tourCompleted')) {
        hopscotch.startTour(self);
      }
      $('.main').on('click', '.start-tour', function(){
        hopscotch.startTour(self);
      });
    },
    id: "version-tour",
    steps: [
      {
        title: "Changes to versioning",
        content: "Plans or templates with the same name are now combined into one view. You can click this dropdown to select older versions of this plan or template.",
        target: ".version-select",
        placement: "bottom",
        xOffset: -90,
        arrowOffset: 'center'
      },
      {
        title: "Activate old plans or templates",
        content: "If a plan or template is deactivated, you can click here to set it as active. This will deactivate all other plans or templates with this name.",
        target: ".badge",
        placement: "bottom"
      },
      {
        title: "Related plans",
        content: "You can click here to see all plans that are currently using this template. It may be a good idea to review the related plans before activating an older version of a template (it's possible someone else's plan is using your template, and you don't want to ruin their plan!)",
        target: ".view-related",
        placement: "bottom"
      },
      {
        title: "Learn about versioning",
        content: "Click this button to restart this tutorial if you need a reminder.",
        target: ".start-tour",
        placement: "bottom",
        xOffset: -20
      }
    ],
    onEnd: function(){
      iris.versionTour.saveState();
    },
    onClose: function(){
      iris.versionTour.saveState();
    },
    saveState: function(){
      localStorage.setItem('tourCompleted', true);
    },
    showPrevButton: true,
  },
  registerHandlebarHelpers: function(){
    // Register handlebars helpers
    Handlebars.registerHelper('isSelected', function(val, check){
      return val === check ? 'selected': '';
    });
    Handlebars.registerHelper('isActive', function(yes){
      return yes ? 'active': '';
    });
    Handlebars.registerHelper('ifExists', function(val, opts){
      return typeof(val) !== 'undefined' ? opts.fn(this) : opts.inverse(this);
    });
    Handlebars.registerHelper('isEqual', function(val1, val2, opts){
      return val1 === val2 ? opts.fn(this) : opts.inverse(this);
    });
    Handlebars.registerHelper('isUser', function(val1, opts){
      return val1 === window.appData.user ? opts.fn(this) : opts.inverse(this);
    });
    Handlebars.registerHelper('divide', function(val1, val2){
      return val1 / val2;
    });
    Handlebars.registerHelper('prettyPrint', function(val){
      return typeof(val) === 'string' ? val : "{...}";
    });
    Handlebars.registerHelper('secondsToMinutes', function(val){
      if (val) {
        return parseFloat((val / 60).toFixed(2));
      } else {
        return 0;
      }
    });
    Handlebars.registerHelper('convertToLocal', function(time){
      if (time) {
        return moment.unix(time).local().format('YYYY-MM-DD HH:mm:ss [GMT]ZZ');
      }
    });
    Handlebars.registerHelper('breakLines', function(text, type){
      if (text) {
        text = Handlebars.Utils.escapeExpression(text);
        if (type && type === 'input') {
          text = text.replace(/(\r\n|\n|\r)/gm, '&#13;&#10;');
        } else {
          text = text.replace(/(\r\n|\n|\r)/gm, '<br />');
        }

        return new Handlebars.SafeString(text);
      }
    });
    Handlebars.registerHelper('getValForKey', function (obj, val1, val2, breakLines) {
      //gets nested value from an object with a dynamic key.
      //obj = object to get val from
      //val1 = key to get val from
      //val2 = key within val1 to get the value from
      //breakLines = replaces \n with <br /> tag for view mode of templates
      var text = obj[val1][val2];
      if (breakLines === true) {
        text = Handlebars.helpers.breakLines(text);
      } else {
        text = Handlebars.Utils.escapeExpression(text);
        text = text.replace(/(\r\n|\n|\r)/gm, '&#13;&#10;');
      }
      return new Handlebars.SafeString(text);
    });
    Handlebars.registerHelper('trim', function(string, start, end) {
      if (string) {
        return string.slice(start, end);
      } else {
        return string
      }
    });
  } //end registerHandlebarHelpers
}; //end iris

iris.init();

$(function () {

    $('#btn-submit').click(function () {

        var username = $('#username').val();
        var password = $('#password').val();

        $.ajax({
            url: '/register/post',
            method: 'POST',
            data: {
                username: username,
                password: password
            },
            success: function () {
                alert('Success');
            }

        });

    });

});
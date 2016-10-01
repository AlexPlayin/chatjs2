function Client(target, myusername) {
    var socket = io(target);


    socket.on('connect', function () {
        socket.emit('handshake', {
            username: myusername
        });
        socket.emit('status', 'test');


    });
    // neue Nachricht
    socket.on('chat', function (data) {
        var zeit = new Date(data.zeit);
        $('.chat-message').append(
            $('<li></li>').append(
                // Uhrzeit
                $('<span>').text('[' +
                    (zeit.getHours() < 10 ? '0' + zeit.getHours() : zeit.getHours()) + ':' +
                    (zeit.getMinutes() < 10 ? '0' + zeit.getMinutes() : zeit.getMinutes()) + '] '
                ),
                // Name
                $('<b>').text(typeof (data.name) != 'undefined' ? data.name + ': ' : ''),
                // Text
                $('<span>').text(data.text))
        );
        // nach unten scrollen
        $('.chat-body').scrollTop($('.chat-body')[0].scrollHeight);
    });

    // Nachricht senden
    function senden() {
        // Eingabefelder auslesen
        if ($('#new-msg-input').val() === "") {

        } else {
            var name = 'Alex';
            var text = $('#new-msg-input').val();
            // Socket senden
            socket.emit('chat', {
                name: myusername,
                text: text
            });
            // Text-Eingabe leeren
            $('#new-msg-input').val('');
        }
    }
    // bei einem Klick
    // $('#senden').click(senden);
    // oder mit der Enter-Taste
    $('#new-msg-input').keypress(function (e) {
        if (e.which == 13) {

            senden();

        }
    });
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Client;
} else {
    window.Client = Client;
}
